require('dotenv').config();
const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts, appendBezierCurve } = require('pdf-lib');

async function Test(req, res) {
  fs.readFile('./data/DHL_tax_template.pdf', async function (err, existingPdfBytes) {
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
      x: 145,
      y: height - 181,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add tracking number
    firstPage.drawText(`${req.query.tracking}`, {
      x: 230,
      y: height - 300,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add account number
    firstPage.drawText(`${process.env.COMPANY_DHL_ACCOUNT}`, {
      x: 233,
      y: height - 317,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company name
    firstPage.drawText(`${process.env.COMPANY_COMPANY}`, {
      x: 260,
      y: height - 343,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company contact person
    firstPage.drawText(`${process.env.COMPANY_CONTACT}`, {
      x: 200,
      y: height - 366,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company phone number
    firstPage.drawText(`${process.env.COMPANY_PHONE}`, {
      x: 200,
      y: height - 390,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company email
    firstPage.drawText(`${process.env.COMPANY_EMAIL}`, {
      x: 200,
      y: height - 414,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add company address
    firstPage.drawText(`${process.env.COMPANY_ADDRESS}`, {
      x: 150,
      y: height - 460,
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
}

Test({ query: { tracking: '1223021553' } }, null);
