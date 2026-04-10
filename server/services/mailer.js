const nodemailer = require('nodemailer');

function createMailer(creds) {
  function getTransport() {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: creds.GMAIL_USER,
        pass: creds.GMAIL_APP_PASSWORD,
      },
    });
  }

  async function sendTimesheetSummary({ to, period, summary }) {
    const transport = getTransport();
    const rows = summary.map(s =>
      `<tr><td>${s.key}</td><td>${s.summary}</td><td>${s.hours}h</td></tr>`
    ).join('');

    const total = summary.reduce((acc, s) => acc + s.hours, 0).toFixed(2);

    await transport.sendMail({
      from: creds.GMAIL_USER,
      to,
      subject: `Timesheet submitted — ${period.from} to ${period.to}`,
      html: `
        <h2>Timesheet Summary</h2>
        <p>Period: <strong>${period.from}</strong> to <strong>${period.to}</strong></p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif">
          <thead><tr><th>Issue</th><th>Summary</th><th>Hours</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="2"><strong>Total</strong></td><td><strong>${total}h</strong></td></tr></tfoot>
        </table>
        <p style="color:#888;font-size:12px">Sent via Daypilot</p>
      `,
    });
  }

  return { sendTimesheetSummary };
}

module.exports = createMailer;
