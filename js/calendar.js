// Calendar functionality for events page

// JSONP utility function for cross-origin requests
function jsonp(url, onSuccess, onError) {
    const callbackName = 'jsonp_' + Math.random().toString(36).substring(2, 15);
    const script = document.createElement('script');
    
    window[callbackName] = function(data) {
        delete window[callbackName];
        document.head.removeChild(script);
        if (onSuccess) onSuccess(data);
    };
    
    script.onerror = function() {
        delete window[callbackName];
        document.head.removeChild(script);
        if (onError) onError(new Error('JSONP request failed'));
    };
    
    const separator = url.includes('?') ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName;
    document.head.appendChild(script);
}

let calendar;
let calendarInitialized = false;
let allEvents = []; // Store all events for the upcoming events list

// Configuration - Google Apps Script backend
const GOOGLE_APPS_SCRIPT_URL = window.GOOGLE_APPS_SCRIPT_URL || 'YOUR_APPS_SCRIPT_URL_HERE';

document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const eventModal = document.getElementById('event-modal');
    const modalCloseBtn = document.getElementById('modal-close');
    const upcomingEventsEl = document.getElementById('upcoming-events');
    
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
        calendarEl.innerHTML = '<p class="text-center text-text-secondary p-8">Kalendri laadimine...</p>';

        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'et',
            firstDay: 1,
            allDaySlot: false,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: '' // Remove view selector - only monthly view
            },
            buttonText: { today: 'Täna' },
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
                info.el.style.cursor = 'pointer';
            },
            height: 'auto'
        });
        calendar.render();
        calendarInitialized = true;
    }
    
    function loadCalendarEvents(successCallback, failureCallback) {
        // Build URL for Apps Script endpoint
        const url = `${GOOGLE_APPS_SCRIPT_URL}?action=calendar`;
        
        // Show loading state
        console.log('Fetching calendar events from backend...');
        
        // Use JSONP to avoid CORS issues
        jsonp(url, function(data) {
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
                
                // Store all events
                allEvents = events;
                
                // Update upcoming events list
                updateUpcomingEventsList();
                
                console.log(`Loaded ${events.length} events${data.cached ? ' (cached)' : ''}`);
                successCallback(events);
            } else {
                console.warn('Invalid calendar response, using example events');
                loadExampleCalendarEvents(successCallback);
            }
        }, function(error) {
            console.error('Calendar fetch error:', error);
            // Fallback to example events
            loadExampleCalendarEvents(successCallback);
        });
    }
    
    function loadExampleCalendarEvents(successCallback) {
        const today = new Date();
        const exampleEvents = [
            {
                id: '1',
                title: 'Kogukonna koosolek',
                start: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
                description: 'Arutame kogukonna arenguplaane ja tulevasi üritusi.',
                location: 'Kaiu Kultuurimaja',
                allDay: false
            },
            {
                id: '2',
                title: 'Kevadine talgupäev',
                start: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                allDay: true,
                description: 'Koristame üheskoos küla ja korrastame mänguväljaku.',
                location: 'Kaiu keskväljak'
            },
            {
                id: '3',
                title: 'Lasteaed külastab raamatukogu',
                start: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
                description: 'Lasteaia vanem rühm külastab raamatukogu.',
                location: 'Kaiu Raamatukogu',
                allDay: false
            },
            {
                id: '4',
                title: 'Külapäev',
                start: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                allDay: true,
                description: 'Traditsiooniline külapäev kogu perele. Laat, kontsert, mängud lastele.',
                location: 'Kaiu park'
            },
            {
                id: '5',
                title: 'Jõuluturg',
                start: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
                allDay: true,
                description: 'Käsitöö, kodused hõrgutised ja jõuluvana.',
                location: 'Kaiu Kultuurimaja'
            }
        ];
        
        // Store all events
        allEvents = exampleEvents;
        
        // Update upcoming events list
        updateUpcomingEventsList();
        
        successCallback(exampleEvents);
    }
    
    function updateUpcomingEventsList() {
        if (!upcomingEventsEl) return;
        
        // Sort events by start date
        const now = new Date();
        const upcomingEvents = allEvents
            .filter(event => new Date(event.start) >= now)
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 5); // Get next 5 events
        
        if (upcomingEvents.length === 0) {
            upcomingEventsEl.innerHTML = '<p class="text-center text-text-secondary p-4">Ühtegi tulevast sündmust ei ole planeeritud.</p>';
            return;
        }
        
        // Create event list HTML
        let eventsHTML = '';
        upcomingEvents.forEach(event => {
            const startDate = new Date(event.start);
            const endDate = event.end ? new Date(event.end) : null;
            
            // Format date
            const dateOptions = { day: 'numeric', month: 'long' };
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            
            let dateStr = startDate.toLocaleDateString('et-EE', dateOptions);
            if (!event.allDay) {
                dateStr += ' kell ' + startDate.toLocaleTimeString('et-EE', timeOptions);
            }
            
            eventsHTML += `
                <div class="event-list-item p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                     onclick="showEventFromList('${event.id}')">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-900">${event.title}</h4>
                            <p class="text-sm text-gray-600 mt-1">${dateStr}</p>
                            ${event.location ? `<p class="text-sm text-gray-500 mt-1">📍 ${event.location}</p>` : ''}
                        </div>
                        <svg class="w-5 h-5 text-gray-400 flex-shrink-0 ml-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            `;
        });
        
        upcomingEventsEl.innerHTML = eventsHTML;
    }
    
    // Make function globally available for onclick
    window.showEventFromList = function(eventId) {
        const event = allEvents.find(e => e.id === eventId);
        if (event) {
            // Create a mock event object similar to FullCalendar's event
            const mockEvent = {
                title: event.title,
                start: new Date(event.start),
                end: event.end ? new Date(event.end) : null,
                allDay: event.allDay,
                extendedProps: {
                    description: event.description,
                    location: event.location
                }
            };
            showEventModal(mockEvent);
        }
    };
    
    function showEventModal(event) {
        document.getElementById('modal-title').textContent = event.title;
        const start = event.start instanceof Date ? event.start : new Date(event.start);
        const end = event.end instanceof Date ? event.end : (event.end ? new Date(event.end) : null);
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        
        let timeString = start.toLocaleDateString('et-EE', options);
        
        if (!event.allDay) {
            timeString += ' kell ' + start.toLocaleTimeString('et-EE', timeOptions);
            if (end && start.toDateString() === end.toDateString()) {
                timeString += ' - ' + end.toLocaleTimeString('et-EE', timeOptions);
            } else if (end) {
                timeString += ' - ' + end.toLocaleDateString('et-EE', options) + ' kell ' + end.toLocaleTimeString('et-EE', timeOptions);
            }
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