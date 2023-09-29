/**************************
 *
 * Added invoice document
 * -- Consider adding DHL product details document
 * -- Consider adding DHL clock document
 *
 */

const fs = require('fs');
const { degrees, PDFDocument, rgb, StandardFonts, appendBezierCurve } = require('pdf-lib');
const { HSCodeList } = require('../sequelize');

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

exports.invoice = async (req, res) => {
  // Get data from HS code DB, and add autocomplete when you input an invoice name
  const hs_data = await HSCodeList.findAll();
  const name_to_hs = {};
  const name_list = [];
  const hs_list = [];
  hs_data.sort((a, b) => {
    if (a.uses > b.uses) return -1;
    if (a.uses < b.uses) return 1;
    return 0;
  });
  hs_data.forEach(hs => {
    name_to_hs[hs.name] = hs.code;
    if (name_list.indexOf(hs.name) === -1) name_list.push(hs.name);
    if (hs_list.indexOf(hs.code) === -1) hs_list.push(hs.code);
  });

  res.render("pdf_invoice", {name_to_hs, name_list, hs_list});
}

exports.generate_invoice = async (req, res) => {
  const pdfDoc = await PDFDocument.create();
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const logo_png = fs.readFileSync("./data/amiami_logo_mono.png", null);
  const logo = await pdfDoc.embedPng(logo_png);
  const logoDims = logo.scale(0.15);

  // Settings
  const include_hs = "include_hs" in req.body && req.body.include_hs === 'on';
  let gst_vat_type = 'GST';
  if (false/*req.body.gst_type === VAT type country*/) {
    gst_vat_type = 'VAT'
  }
  const gst_paid = `(${gst_vat_type} Paid)`;
  

  // Font styles
  const fsize_title = 25;
  const fsize_text = 12;
  const fsize_text_small = 10;
  const fcolor_black = rgb(0, 0, 0);
  const fcolor_gray = rgb(0.25, 0.25, 0.25);
  const fcolor_lightgray = rgb(0.85, 0.85, 0.85);
  const fcolor_white = rgb(1, 1, 1);

  // Add logo
  page.drawImage(logo, {
    x: 50,
    y: height - logoDims.height - 15,
    width: logoDims.width,
    height: logoDims.height,
  })

  // Commercial Invoice and invoice number
  page.drawText('Commercial Invoice', {
    x: width / 2 + 35,
    y: height - 50,
    size: fsize_title,
    font: fontHelvetica,
    color: fcolor_black,
  })
  page.drawText(`# ${req.body.order}`, {
    x: width - 120,
    y: height - 70,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  })

  // Sender address
  const address_x = 60;
  const address_y = height - 75;
  const address_row_height = 14;
  const amiami_address = [
    "AmiAmi / Oh-ami Inc.",
    "4-9-1 Oyamagaoka",
    "Machida-shi, Tokyo 194-0215",
    "JAPAN",
    "+1(424)306-0591"
  ];
  let cnt = 0;
  amiami_address.forEach((v, i) => {
    if(v.length > 0) {
      page.drawText(v, {
        x: address_x,
        y: address_y - (address_row_height * cnt),
        size: fsize_text,
        font: i === 0 ? fontHelveticaBold : fontHelvetica,
        color: fcolor_black,
      });
      cnt++;
    }
  });

  // Receiver address
  let delimiter = '\n';
  if (req.body.address.indexOf('\r\n') >= 0) delimiter = '\r\n';
  const address_parts = req.body.address.split(delimiter);
  cnt += 3;
  page.drawText("Bill To:", {
    x: address_x,
    y: address_y - (address_row_height * (cnt-1)) + 4,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  address_parts.forEach((v, i) => {
    if(v.length > 0) {
      page.drawText(v, {
        x: address_x,
        y: address_y - (address_row_height * cnt),
        size: fsize_text,
        font: i === 0 ? fontHelveticaBold : fontHelvetica,
        color: fcolor_black,
      });
      cnt++;
    }
  });

  // Shipping/Payment details
  const x_offset = 3 * width / 4 - 30;
  const x_val_offset = width - 50;
  page.drawRectangle({
    x: width / 2,
    y: height - 230,
    width: width / 2 - 40,
    height: 25,
    color: fcolor_lightgray,
  });
  // Shipping date
  const shipdate = new Date(req.body.shipdate);
  let text_width = fontHelvetica.widthOfTextAtSize("Shipping Date:", fsize_text);
  page.drawText("Shipping Date:", {
    x: x_offset - text_width,
    y: height - 230 + 85,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(shipdate.toDateString(), fsize_text);
  page.drawText(shipdate.toDateString(), {
    x: x_val_offset - text_width,
    y: height - 230 + 85,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  // Payment method
  text_width = fontHelvetica.widthOfTextAtSize("Payment Terms:", fsize_text);
  page.drawText("Payment Terms:", {
    x: x_offset - text_width,
    y: height - 230 + 60,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(req.body.payment_method, fsize_text);
  page.drawText(req.body.payment_method, {
    x: x_val_offset - text_width,
    y: height - 230 + 60,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  // Payment date
  const paydate = new Date(req.body.paydate);
  text_width = fontHelvetica.widthOfTextAtSize("Payment Date:", fsize_text);
  page.drawText("Payment Date:", {
    x: x_offset - text_width,
    y: height - 230 + 35,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(paydate.toDateString(), fsize_text);
  page.drawText(paydate.toDateString(), {
    x: x_val_offset - text_width,
    y: height - 230 + 35,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  // Due amount (always 0 JPY)
  text_width = fontHelveticaBold.widthOfTextAtSize("Balance Due:", fsize_text);
  page.drawText("Balance Due:", {
    x: x_offset - text_width,
    y: height - 230 + 10,
    size: fsize_text,
    font: fontHelveticaBold,
    color: fcolor_black,
  });
  text_width = fontHelveticaBold.widthOfTextAtSize("0 JPY", fsize_text);
  page.drawText("0 JPY", {
    x: x_val_offset - text_width,
    y: height - 230 + 10,
    size: fsize_text,
    font: fontHelveticaBold,
    color: fcolor_black,
  });

  // Items
  page.drawRectangle({
    x: 40,
    y: height - 300,
    width: width - 80,
    height: 20,
    color: fcolor_black,
  });
  let current_page = page;
  let item_row_offset = height - 300 - 20;
  const item_row_height = 35;
  let item_column = 50;
  let hs_column = width / 2 - 15;
  let quantity_column = width / 2 + 75;
  let rate_column = width - 125;
  let amount_column = width - 50;
  page.drawText("Item", {
    x: item_column,
    y: height - 300 + 6,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_white,
  });
  if (include_hs) {
    page.drawText("HS Code", {
      x: hs_column,
      y: height - 300 + 6,
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_white,
    });
  }
  page.drawText("Quantity", {
    x: quantity_column - 20,
    y: height - 300 + 6,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_white,
  });
  text_width = fontHelvetica.widthOfTextAtSize("Rate", fsize_text);
  page.drawText("Rate", {
    x: rate_column - text_width - 15,
    y: height - 300 + 6,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_white,
  });
  text_width = fontHelvetica.widthOfTextAtSize("Amount", fsize_text);
  page.drawText("Amount", {
    x: amount_column - text_width - 10,
    y: height - 300 + 6,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_white,
  });
  // Add items
  cnt = 0;
  let subtotal = 0;
  for (let i = 0; `item${i}_invoice` in req.body; i++) {
    // Check if entry don't fit on current page
    if (item_row_offset - item_row_height * cnt < 75)
    {
      // Go to next page
      current_page = pdfDoc.addPage();
      current_page.drawRectangle({
        x: 40,
        y: height - 50,
        width: width - 80,
        height: 20,
        color: fcolor_black,
      });
      current_page.drawText("Item", {
        x: item_column,
        y: height - 50 + 6,
        size: fsize_text,
        font: fontHelvetica,
        color: fcolor_white,
      });
      if (include_hs) {
        current_page.drawText("HS Code", {
          x: hs_column,
          y: height - 50 + 6,
          size: fsize_text,
          font: fontHelvetica,
          color: fcolor_white,
        });
      }
      current_page.drawText("Quantity", {
        x: quantity_column - 20,
        y: height - 50 + 6,
        size: fsize_text,
        font: fontHelvetica,
        color: fcolor_white,
      });
      text_width = fontHelvetica.widthOfTextAtSize("Rate", fsize_text);
      current_page.drawText("Rate", {
        x: rate_column - text_width - 15,
        y: height - 50 + 6,
        size: fsize_text,
        font: fontHelvetica,
        color: fcolor_white,
      });
      text_width = fontHelvetica.widthOfTextAtSize("Amount", fsize_text);
      current_page.drawText("Amount", {
        x: amount_column - text_width - 10,
        y: height - 50 + 6,
        size: fsize_text,
        font: fontHelvetica,
        color: fcolor_white,
      });
      item_row_offset = height - 70;
      cnt = 0;
    }
    current_page.drawText(req.body[`item${i}_invoice`], {
      x: item_column,
      y: item_row_offset - item_row_height * cnt,
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    if (include_hs) {
      current_page.drawText(req.body[`item${i}_hs`], {
        x: hs_column,
        y: item_row_offset - item_row_height * cnt,
        size: fsize_text,
        font: fontHelvetica,
        color: fcolor_black,
      });
    }
    text_width = fontHelvetica.widthOfTextAtSize(req.body[`item${i}_q`], fsize_text);
    current_page.drawText(req.body[`item${i}_q`], {
      x: quantity_column - text_width / 2,
      y: item_row_offset - item_row_height * cnt,
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    text_width = fontHelvetica.widthOfTextAtSize(`${parseInt(req.body[`item${i}_rate`]).toLocaleString()} JPY`, fsize_text);
    current_page.drawText(`${parseInt(req.body[`item${i}_rate`]).toLocaleString()} JPY`, {
      x: rate_column - text_width,
      y: item_row_offset - item_row_height * cnt,
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    const amount = parseInt(req.body[`item${i}_q`]) * parseInt(req.body[`item${i}_rate`]);
    subtotal += amount;
    text_width = fontHelvetica.widthOfTextAtSize(`${amount.toLocaleString()} JPY`, fsize_text);
    current_page.drawText(`${amount.toLocaleString()} JPY`, {
      x: amount_column - text_width + 5,
      y: item_row_offset - item_row_height * cnt,
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    // If GST/VAT show "GST/VAT Paid" centered under Rate/Amount
    if (req.body.gst_type !== '') {
      current_page.drawText(gst_paid, {
        x: rate_column - 15,
        y: item_row_offset - item_row_height * cnt - 14,
        size: fsize_text_small,
        font: fontHelvetica,
        color: fcolor_gray,
      });
    }
    // Remarks
    current_page.drawText(`${req.body[`item${i}_remarks`]}`, {
      x: item_column + 5,
      y: item_row_offset - item_row_height * cnt - 14,
      size: fsize_text_small,
      font: fontHelvetica,
      color: fcolor_gray,
    });
    // Divider line
    current_page.drawLine({
      start: { x: 40, y: item_row_offset - item_row_height * cnt - 17 },
      end: { x: width - 40, y: item_row_offset - item_row_height * cnt - 17 },
      thickness: 1,
      color: fcolor_black,
      opacity: 0.1,
    })

    cnt++;
  }

  // Total section (Subtotal, Shipping, GST/VAT, Total, AmiAmi Points Used, Amount Paid)
  // const x_offset = 3 * width / 4 - 30;
  // const x_val_offset = width - 50;
  const total_y_offset = 250 - (req.body.gst_type === '' ? 25 : 0) - (req.body.amiami_point === '0' ? 50 : 0);
  const row_height = 25;
  // Check if section don't fit on current page
  if (item_row_offset - item_row_height * cnt < total_y_offset) {
    // Go to next page
      current_page = pdfDoc.addPage();
  }
  cnt = 0;
  // Subtotal
  text_width = fontHelvetica.widthOfTextAtSize("Subtotal:", fsize_text);
  current_page.drawText("Subtotal:", {
    x: x_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(`${subtotal.toLocaleString()} JPY`, fsize_text);
  current_page.drawText(`${subtotal.toLocaleString()} JPY`, {
    x: x_val_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  cnt++;
  // Shipping
  text_width = fontHelvetica.widthOfTextAtSize("Shipping:", fsize_text);
  current_page.drawText("Shipping:", {
    x: x_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(`${parseInt(req.body.shipping).toLocaleString()} JPY`, fsize_text);
  current_page.drawText(`${parseInt(req.body.shipping).toLocaleString()} JPY`, {
    x: x_val_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  cnt++;
  // GST/VAT
  if (req.body.gst_type !== '') {
    text_width = fontHelvetica.widthOfTextAtSize(`${gst_vat_type}:`, fsize_text);
    current_page.drawText(`${gst_vat_type}:`, {
      x: x_offset - text_width,
      y: total_y_offset - (row_height * cnt),
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_gray,
    });
    text_width = fontHelvetica.widthOfTextAtSize(`${parseInt(req.body.gst).toLocaleString()} JPY`, fsize_text);
    current_page.drawText(`${parseInt(req.body.gst).toLocaleString()} JPY`, {
      x: x_val_offset - text_width,
      y: total_y_offset - (row_height * cnt),
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    cnt++;
  }
  // Total Cost
  const total_cost = subtotal + parseInt(req.body.shipping) + parseInt(req.body.gst);
  text_width = fontHelvetica.widthOfTextAtSize("Total Cost:", fsize_text);
  current_page.drawText("Total Cost:", {
    x: x_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(`${total_cost.toLocaleString()} JPY`, fsize_text);
  current_page.drawText(`${total_cost.toLocaleString()} JPY`, {
    x: x_val_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  // Divider line
  current_page.drawLine({
    start: { x: width / 2, y: total_y_offset - (row_height * cnt) - 8 },
    end: { x: width - 40, y: total_y_offset - (row_height * cnt) - 8 },
    thickness: 1,
    color: fcolor_black,
  })
  cnt++;
  // AmiAmi Points Used
  if (req.body.amiami_point !== '0') {
    text_width = fontHelvetica.widthOfTextAtSize("AmiAmi Points Used:", fsize_text);
    current_page.drawText("AmiAmi Points Used:", {
      x: x_offset - text_width,
      y: total_y_offset - (row_height * cnt),
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_gray,
    });
    text_width = fontHelvetica.widthOfTextAtSize(`${parseInt(req.body.amiami_point).toLocaleString()} JPY`, fsize_text);
    current_page.drawText(`${parseInt(req.body.amiami_point).toLocaleString()} JPY`, {
      x: x_val_offset - text_width,
      y: total_y_offset - (row_height * cnt),
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    cnt++;
    // Amount Paid
    const money_paid = total_cost - parseInt(req.body.amiami_point);
    text_width = fontHelvetica.widthOfTextAtSize("Amount Paid:", fsize_text);
    current_page.drawText("Amount Paid:", {
      x: x_offset - text_width,
      y: total_y_offset - (row_height * cnt),
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_gray,
    });
    text_width = fontHelvetica.widthOfTextAtSize(`${money_paid.toLocaleString()} JPY`, fsize_text);
    current_page.drawText(`${money_paid.toLocaleString()} JPY`, {
      x: x_val_offset - text_width,
      y: total_y_offset - (row_height * cnt),
      size: fsize_text,
      font: fontHelvetica,
      color: fcolor_black,
    });
    cnt++;
  }
  // Total Paid
  text_width = fontHelvetica.widthOfTextAtSize("Total Paid:", fsize_text);
  current_page.drawText("Total Paid:", {
    x: x_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  text_width = fontHelvetica.widthOfTextAtSize(`${total_cost.toLocaleString()} JPY`, fsize_text);
  current_page.drawText(`${total_cost.toLocaleString()} JPY`, {
    x: x_val_offset - text_width,
    y: total_y_offset - (row_height * cnt),
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_black,
  });
  cnt++;

  // Remarks section
  delimiter = '\n';
  if (req.body.remarks.indexOf('\r\n') >= 0) delimiter = '\r\n';
  const remarks = req.body.remarks.split(delimiter);
  current_page.drawText("Remarks:", {
    x: 50,
    y: 100,
    size: fsize_text,
    font: fontHelvetica,
    color: fcolor_gray,
  });
  // unshift in GST/VAT remark
  if (req.body.gst_type === 'Australia') {
    remarks.unshift(`10% GST charged on merchandise price and shipping cost (ARN: 3000 1363 1153)`);
  } else if (req.body.gst_type === 'New Zealand') {
    remarks.unshift(`15% GST charged on merchandise price and shipping cost (GST number: 130-703-607)`);
  } else if (req.body.gst_type === 'Singapore') {
    remarks.unshift(`8% GST charged on merchandise price and shipping cost (GST number: M90375235L)`);
  } else if (req.body.gst_type === 'Singapore2024') {
    remarks.unshift(`9% GST charged on merchandise price and shipping cost (GST number: M90375235L)`);
  }
  remarks.unshift(`Invoice for ${req.body.shipping_method} shipment ${req.body.tracking}`);
  cnt = 0;
  remarks.forEach(r => {
    if (r.length > 0) {
      current_page.drawText(`- ${r}`, {
        x: 50,
        y: 85 - 12 * cnt,
        size: fsize_text_small,
        font: fontHelvetica,
        color: fcolor_black,
      });
      cnt++;
    }
  });

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await pdfDoc.save()
  const pdfBuffer = Buffer.from(pdfBytes.buffer, 'binary');

  // Send pdf to user
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice_${req.body.order}.pdf"`);
  res.send(pdfBuffer);
}
