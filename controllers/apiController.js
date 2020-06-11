const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts, appendBezierCurve } = require('pdf-lib');

exports.page = (req, res) => {
  res.render('documents');
};

exports.get_pdf = async function (req, res) {
  fs.readFile('./data/DHL_return_request.pdf', async function (err, existingPdfBytes) {
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
    firstPage.drawText(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, {
      x: 140,
      y: height - 91,
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

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes.buffer, 'binary');

    // Send pdf to user
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.query.tracking}_return_request.pdf"`);
    res.send(pdfBuffer);
  });
};
