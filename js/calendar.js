// Calendar functionality for events page

let calendar;
let calendarInitialized = false;

// Configuration
const GOOGLE_CALENDAR_ID = '3ab658c2becd62b9af62343da736243b73e1d56523c7c04b8ed46d944eb0e8fb@group.calendar.google.com';
const GOOGLE_API_KEY = 'PUT YOUR GOOGLE API KEY HERE';

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
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 1);
        const timeMax = new Date();
        timeMax.setMonth(timeMax.getMonth() + 6);

        const url = `https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events?` +
            `key=${GOOGLE_API_KEY}&` +
            `timeMin=${timeMin.toISOString()}&` +
            `timeMax=${timeMax.toISOString()}&` +
            `singleEvents=true&` +
            `orderBy=startTime`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Google Calendar API error:', data.error);
                    loadExampleCalendarEvents(successCallback);
                } else {
                    const events = data.items.map(item => ({
                        id: item.id,
                        title: item.summary,
                        start: item.start.dateTime || item.start.date,
                        end: item.end.dateTime || item.end.date,
                        description: item.description || '',
                        location: item.location || '',
                        allDay: !item.start.dateTime
                    }));
                    successCallback(events);
                }
            })
            .catch(error => {
                console.error('Calendar fetch error:', error);
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
