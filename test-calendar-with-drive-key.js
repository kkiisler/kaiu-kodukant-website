#!/usr/bin/env node

/**
 * Test Calendar API with the Drive API key
 */

const axios = require('axios').default;

const API_KEY = 'AIzaSyCNpCJ0tk2CPh5JKfn2l6qZM9lp5e08JBQ'; // Drive API key
const CALENDAR_ID = 'a0b18dc4b7e4b9b40858746a7edddaa51b41014085ba2f4b2f89bf038ac13f12@group.calendar.google.com';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testCalendarAPI() {
  log('\n' + colors.bold + '🧪 TESTING CALENDAR API WITH DRIVE KEY' + colors.reset);
  log('════════════════════════════════════════════\n');

  log(`API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`, 'yellow');
  log(`Calendar ID: ${CALENDAR_ID.substring(0, 40)}...\n`);

  // Set time range
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(now.getMonth() - 1);
  const timeMax = new Date(now);
  timeMax.setMonth(now.getMonth() + 6);

  log(`📅 Fetching events from ${timeMin.toLocaleDateString()} to ${timeMax.toLocaleDateString()}`, 'cyan');
  log('🔄 Sending request to Calendar API...\n', 'yellow');

  try {
    const response = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        params: {
          key: API_KEY,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 20
        },
        validateStatus: null,
        timeout: 15000
      }
    );

    if (response.status === 200) {
      const events = response.data.items || [];

      log('═'.repeat(60), 'green');
      log('✅ SUCCESS! Calendar API is ENABLED and WORKING!', 'green');
      log('═'.repeat(60), 'green');

      log(`\n📊 Found ${events.length} events in the calendar`, 'green');

      if (events.length > 0) {
        log('\n📅 Upcoming Events:', 'magenta');
        log('─'.repeat(60), 'cyan');

        events.slice(0, 10).forEach((event, i) => {
          const startDate = event.start?.dateTime || event.start?.date;
          const endDate = event.end?.dateTime || event.end?.date;
          const isAllDay = !event.start?.dateTime;

          log(`\n${i + 1}. ${colors.bold}${event.summary || 'Unnamed Event'}${colors.reset}`);

          if (isAllDay) {
            log(`   📍 All-day event: ${new Date(startDate).toLocaleDateString('et-EE')}`, 'white');
          } else {
            log(`   📍 ${new Date(startDate).toLocaleString('et-EE')}`, 'white');
          }

          if (event.location) {
            log(`   📌 ${event.location}`, 'white');
          }

          if (event.description) {
            const desc = event.description.substring(0, 100);
            log(`   📝 ${desc}${event.description.length > 100 ? '...' : ''}`, 'white');
          }
        });

        if (events.length > 10) {
          log(`\n... and ${events.length - 10} more events`, 'cyan');
        }
      } else {
        log('\nℹ️  No events found in the specified time range', 'yellow');
      }

      log('\n' + '═'.repeat(60), 'cyan');
      log('🎉 BOTH APIs ARE NOW WORKING!', 'green');
      log('═'.repeat(60), 'cyan');

      log('\n✅ Drive API: Working (tested earlier)', 'green');
      log(`✅ Calendar API: Working (${events.length} events found)`, 'green');

      log('\n🚀 YOU ARE 100% READY TO MIGRATE!', 'bold');
      log('═'.repeat(60), 'cyan');

      log('\n📝 Add this to your backend .env file:', 'yellow');
      log('─'.repeat(60), 'cyan');
      log(`GOOGLE_API_KEY=${API_KEY}`, 'magenta');
      log(`GOOGLE_CALENDAR_ID=${CALENDAR_ID}`, 'magenta');
      log(`GOOGLE_DRIVE_FOLDER_ID=1t2olfDcjsRHFWovLbiOTRBFMYbZQdNdg`, 'magenta');

      log('\n📚 Migration Resources:', 'yellow');
      log('─'.repeat(60), 'cyan');
      log('• Migration plan: planning/google-plan/README.md', 'white');
      log('• Phase 1 (Calendar): planning/google-plan/implementation/phase1-calendar.md', 'white');
      log('• Phase 2 (Gallery): planning/google-plan/implementation/phase2-gallery.md', 'white');
      log('• Code samples: planning/google-plan/code-samples/', 'white');

      log('\n🎯 Next Steps:', 'yellow');
      log('─'.repeat(60), 'cyan');
      log('1. Add API key to your .env file', 'white');
      log('2. Deploy the Node.js sync services', 'white');
      log('3. Test calendar and gallery sync', 'white');
      log('4. Disable Google Apps Script triggers', 'white');
      log('5. ✨ Enjoy automated sync without reauth! ✨', 'green');

      return { success: true, eventCount: events.length };

    } else if (response.status === 403) {
      log('═'.repeat(60), 'red');
      log('❌ Calendar API NOT ENABLED', 'red');
      log('═'.repeat(60), 'red');

      if (response.data?.error?.message) {
        log(`\nError: ${response.data.error.message}`, 'red');
      }

      log('\n📝 You need to enable Calendar API:', 'yellow');
      log('─'.repeat(60), 'cyan');
      log('1. Click this link:', 'white');
      log('   https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=1063545230535', 'cyan');
      log('2. Click the blue "ENABLE" button', 'white');
      log('3. Wait 1-2 minutes', 'white');
      log('4. Run this test again', 'white');

      return { success: false, error: 'Calendar API not enabled' };

    } else if (response.status === 404) {
      log('❌ Calendar not found', 'red');
      log('The calendar might be private or the ID is incorrect', 'yellow');
      return { success: false, error: 'Calendar not found' };

    } else {
      log(`❌ Unexpected status: ${response.status}`, 'red');
      if (response.data?.error) {
        log(`Error: ${JSON.stringify(response.data.error, null, 2)}`, 'red');
      }
      return { success: false, status: response.status };
    }

  } catch (error) {
    log('═'.repeat(60), 'red');
    log('❌ ERROR', 'red');
    log('═'.repeat(60), 'red');
    log(`\n${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// Run test
if (require.main === module) {
  testCalendarAPI().catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}