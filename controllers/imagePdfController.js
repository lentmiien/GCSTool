const path = require('path');
const { generateImageGridPdf } = require('../services/imagePdfService');

exports.index = (req, res) => {
  res.render('image_pdf', {
    pagetitle: 'Image Grid PDF',
    error: null,
  });
};

exports.generate = async (req, res) => {
  if (!req.files || !req.files.csvFile) {
    return res.status(400).render('image_pdf', {
      pagetitle: 'Image Grid PDF',
      error: 'Please upload a CSV file.',
    });
  }

  const csvFile = req.files.csvFile;
  if (Array.isArray(csvFile)) {
    return res.status(400).render('image_pdf', {
      pagetitle: 'Image Grid PDF',
      error: 'Please upload a single CSV file at a time.',
    });
  }

  try {
    const pdfBuffer = await generateImageGridPdf(csvFile.data);
    const baseName = path.basename(csvFile.name, path.extname(csvFile.name)) || 'image_grid';
    const outputName = `${baseName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).render('image_pdf', {
      pagetitle: 'Image Grid PDF',
      error: error.message || 'Failed to generate PDF. Please try again.',
    });
  }
};
