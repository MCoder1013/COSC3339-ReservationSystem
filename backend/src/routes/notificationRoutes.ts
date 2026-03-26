const nodemailer = require("nodemailer");


async function sendEmail() {
  // Create a transport with your SMTP server settings
  const transport = nodemailer.createTransport({
    host: "smtp.example.com",
    port: 587,
    auth: {
      user: "smtp-user",
      pass: "smtp-pass"
    }
  });