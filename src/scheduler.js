require('dotenv').config();
const cron = require('node-cron');
const { runPipeline } = require('./index');

const CRON_SCHEDULE = '0 19 * * 1-6'; // 7:00 PM, Mon-Sat (market days + Saturday for review)

console.log('='.repeat(60));
console.log('📈 FINews Scheduler Started');
console.log(`⏰ Scheduled to run at 7:00 PM IST (Mon-Sat)`);
console.log(`📧 Sending to: ${process.env.EMAIL_TO}`);
console.log('='.repeat(60));
console.log('');

// Schedule the job
const task = cron.schedule(CRON_SCHEDULE, () => {
    console.log(`\n⏰ Cron triggered at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    runPipeline().catch(err => {
        console.error('Pipeline error:', err.message);
    });
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

// Also support manual trigger via --now
const args = process.argv.slice(2);
if (args.includes('--now') || args.includes('-n')) {
    console.log('🔄 Manual trigger: running pipeline now...');
    runPipeline().catch(err => {
        console.error('Pipeline error:', err.message);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down scheduler...');
    task.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down scheduler...');
    task.stop();
    process.exit(0);
});

console.log('⏳ Waiting for next scheduled run...');
console.log(`   Next trigger: Today/Tomorrow at 7:00 PM IST`);
console.log('   Press Ctrl+C to stop\n');
