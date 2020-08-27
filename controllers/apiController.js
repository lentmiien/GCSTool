const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts, appendBezierCurve } = require('pdf-lib');

exports.page = (req, res) => {
  res.render('documents');
};

exports.get_pdf_dhlreturn = async function (req, res) {
  fs.readFile('./data/DHL_return_request_template.pdf', async function (err, existingPdfBytes) {
    // Load a PDFDocument from the existing PDF bytes
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Embed sign image
    const pngImageBytes = fs.readFileSync('./data/yokoyama.png');
    const pngImage = await pdfDoc.embedPng(pngImageBytes);
    const pngDims = pngImage.scale(0.25);

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
    firstPage.drawText(`${req.query.r_tracking}`, {
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

    // Add "Yokoyama sign"
    firstPage.drawImage(pngImage, {
      x: 190,
      y: height - 670,
      width: pngDims.width,
      height: pngDims.height,
    });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes.buffer, 'binary');

    // Send pdf to user
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.query.r_tracking}_return_request.pdf"`);
    res.send(pdfBuffer);
  });
};

exports.get_pdf_dhltax = async function (req, res) {
  fs.readFile('./data/DHL_tax_template.pdf', async function (err, existingPdfBytes) {
    // Load a PDFDocument from the existing PDF bytes
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Embed sign image
    const pngImageBytes = fs.readFileSync('./data/yokoyama.png');
    const pngImage = await pdfDoc.embedPng(pngImageBytes);
    const pngDims = pngImage.scale(0.25);

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
    firstPage.drawText(`${req.query.t_tracking}`, {
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

    // Add "Yokoyama sign"
    firstPage.drawImage(pngImage, {
      x: 190,
      y: height - 535,
      width: pngDims.width,
      height: pngDims.height,
    });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes.buffer, 'binary');

    // Send pdf to user
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.query.t_tracking}_tax.pdf"`);
    res.send(pdfBuffer);
  });
};
