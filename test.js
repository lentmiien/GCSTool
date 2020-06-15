require('dotenv').config();
const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts, appendBezierCurve } = require('pdf-lib');

async function Test(req, res) {
  fs.readFile('./data/DHL_return_request_template.pdf', async function (err, existingPdfBytes) {
    // Load a PDFDocument from the existing PDF bytes
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Get the first page of the document
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Get the width and height of the first page
    const { width, height } = firstPage.getSize();

    // Add date
    const d = new Date();
    firstPage.drawText(`${d.getFullYear()} / ${d.getMonth() + 1} / ${d.getDate()}`, {
      x: 135,
      y: height - 92,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add tracking number
    firstPage.drawText(`${req.query.tracking}`, {
      x: 230,
      y: height - 211,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add account number
    firstPage.drawText(`${process.env.COMPANY_DHL_ACCOUNT}`, {
      x: 233,
      y: height - 229,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company name
    firstPage.drawText(`${process.env.COMPANY_COMPANY}`, {
      x: 250,
      y: height - 464,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company contact person
    firstPage.drawText(`${process.env.COMPANY_CONTACT}`, {
      x: 215,
      y: height - 487,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company phone number
    firstPage.drawText(`${process.env.COMPANY_PHONE}`, {
      x: 215,
      y: height - 512,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company email
    firstPage.drawText(`${process.env.COMPANY_EMAIL}`, {
      x: 215,
      y: height - 535,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company address
    firstPage.drawText(`${process.env.COMPANY_ADDRESS}`, {
      x: 190,
      y: height - 559,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes.buffer, 'binary');

    // Save file
    fs.writeFile('test_append.pdf', pdfBytes, function (err) {
        if (err) throw err;
        console.log('Appended and Saved!');
    });
  });
};

Test({query:{tracking:"1223008990"}}, null);
