// Calendar functionality for events page

let calendar;
let calendarInitialized = false;

// Configuration - Google Apps Script backend
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const eventModal = document.getElementById('event-modal');
    const modalCloseBtn = document.getElementById('modal-close');
    
    if (!calendarEl) return;

    // Initialize calendar
    initializeCalendar();

    // Event modal close handler
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            eventModal.classList.add('hidden');
            eventModal.classList.remove('flex');
        });
    }

    // Close modal when clicking outside
    if (eventModal) {
        eventModal.addEventListener('click', (e) => {
            if (e.target === eventModal) {
                eventModal.classList.add('hidden');
                eventModal.classList.remove('flex');
            }
        });
    }

    function initializeCalendar() {
        if (calendarInitialized) return;
        
        // Show loading message
        calendarEl.innerHTML = '<p class="text-center text-text-secondary p-8">Sündmuste laadimine...</p>';

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'et',
            firstDay: 1,
            allDaySlot: false,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            buttonText: { today: 'Täna', month: 'Kuu', week: 'Nädal' },
            events: function(fetchInfo, successCallback, failureCallback) {
                loadCalendarEvents(successCallback, failureCallback);
            },
            eventClick: info => {
                info.jsEvent.preventDefault();
                showEventModal(info.event);
            },
            eventDidMount: function(info) {
                // Apply custom styling
                info.el.style.backgroundColor = '#cfcabe';
                info.el.style.borderColor = '#c2a990';
                info.el.style.color = '#111111';
            }
        });
        calendar.render();
        calendarInitialized = true;
    }
    
    function loadCalendarEvents(successCallback, failureCallback) {
        // Build URL for Apps Script endpoint
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
        
        // Show loading state
        console.log('Fetching calendar events from backend...');
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Calendar response:', data);
                
                if (data.status === 'success' && data.events) {
                    // Format events for FullCalendar
                    const events = data.events.map(item => ({
                        id: item.id,
                        title: item.title,
                        start: item.start,
                        end: item.end,
                        description: item.description || '',
                        location: item.location || '',
                        allDay: item.allDay || false
                    }));
                    
                    console.log(`Loaded ${events.length} events${data.cached ? ' (cached)' : ''}`);
                    successCallback(events);
                } else {
                    console.warn('Invalid calendar response, using example events');
                    loadExampleCalendarEvents(successCallback);
                }
            })
            .catch(error => {
                console.error('Calendar fetch error:', error);
                // Fallback to example events
                loadExampleCalendarEvents(successCallback);
            });
    }
    
    function loadExampleCalendarEvents(successCallback) {
        const exampleEvents = [
            {
                id: '1',
                title: 'Näidisündmus - Kogukonna koosolek',
                start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T18:00:00',
                end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T20:00:00',
                description: 'See on näidisündmus, kuna kalendri backend pole veel seadistatud.',
                location: 'Kaiu Kultuurimaja',
                backgroundColor: '#cfcabe',
                borderColor: '#c2a990',
                textColor: '#111111'
            },
            {
                id: '2',
                title: 'Suvefestival',
                start: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                allDay: true,
                description: 'Traditsioonilne suvefestival kogu perele.',
                location: 'Kaiu keskväljak',
                backgroundColor: '#cfcabe',
                borderColor: '#c2a990',
                textColor: '#111111'
            }
        ];
        successCallback(exampleEvents);
    }
    
    function showEventModal(event) {
        document.getElementById('modal-title').textContent = event.title;
        const start = event.start;
        const end = event.end;
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
        let timeString = start.toLocaleString('et-EE', options);
        if (end && !event.allDay) {
            timeString += (start.toDateString() !== end.toDateString())
                ? ' - ' + end.toLocaleString('et-EE', options)
                : ' - ' + end.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        document.getElementById('modal-time').textContent = timeString;
        document.getElementById('modal-description').innerHTML = event.extendedProps.description || '<p>Täpsem kirjeldus puudub.</p>';
        const locationEl = document.getElementById('modal-location');
        const location = event.extendedProps.location;
        locationEl.innerHTML = location ? `📍&nbsp; ${location}` : '';
        locationEl.classList.toggle('hidden', !location);
        eventModal.classList.remove('hidden');
        eventModal.classList.add('flex');
    }
});
