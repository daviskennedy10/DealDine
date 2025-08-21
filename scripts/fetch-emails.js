
require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const DealEmailParser = require('../email/email-parser');

class GmailDealFetcher {
  constructor() {
    this.emailParser = new DealEmailParser();
    this.imap = new Imap({
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASS, // Gmail App Password
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => resolve());
      this.imap.once('error', (err) => reject(err));
      this.imap.connect();
    });
  }

  fetchRecentEmails(limit = 5) {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) return reject(err);
        const since = new Date(Date.now() - 7*24*60*60*1000);
        this.imap.search([['SINCE', since]], (err, results) => {
          if (err) return reject(err);
          if (!results || !results.length) return resolve([]);
          const ids = results.slice(-limit);
          const f = this.imap.fetch(ids, { bodies: '' });
          const emails = [];
          let done = 0;
          f.on('message', (msg) => {
            const email = {};
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (!err && parsed) {
                  email.subject = parsed.subject || '';
                  email.from = parsed.from?.text || '';
                  email.html = parsed.html || '';
                  email.text = parsed.text || '';
                  email.date = parsed.date;
                }
              });
            });
            msg.once('end', () => { emails.push(email); done++; if (done===ids.length) resolve(emails); });
          });
          f.once('error', (err) => reject(err));
        });
      });
    });
  }

  async processEmailsForDeals(emails){
    const all = [];
    for (const e of emails){
      const content = e.html || e.text;
      if (!content) continue;
      const deals = await this.emailParser.parseEmailContent(content, e.subject);
      all.push(...deals);
    }
    return all;
  }
}

async function run(){
  const fetcher = new GmailDealFetcher();
  await fetcher.connect();
  const emails = await fetcher.fetchRecentEmails(5);
  const deals = await fetcher.processEmailsForDeals(emails);
  console.log('Found deals:', deals.length);
  process.exit(0);
}
if (require.main === module){ run(); }
