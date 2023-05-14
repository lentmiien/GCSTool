/****************************
 *
 * version3 TODO
 *
 * allow for custamizable labels and based on label choosen change
 * the input field names and table column names
 * (database columns can remain the same and have a fixed count)
 *
 */

// Require necessary database models
const { FormV2, FormFormat } = require('../sequelize');

exports.index = (req, res) => {
  FormV2.findAll().then((entries) => {
    FormFormat.findAll().then((forms) => {
      res.render('form', { entries, forms });
    });
  });
};

exports.add_post = (req, res) => {
  const new_entry = {
    order: req.body.order,
    processed_by: res.locals.name,
    label1: req.body.label1,
    label2: req.body.label2,
    label3: req.body.label3,
    label4: req.body.label4,
    group_label: req.body.group_label,
  };
  FormV2.create(new_entry);

  setTimeout(() => res.redirect(`/form`), 200);
};

exports.add_format = (req, res) => {
  const new_entry = {
    title: req.body.format_title,
    label1: req.body.format_label1,
    label2: req.body.format_label2,
    label3: req.body.format_label3,
    label4: req.body.format_label4,
    group_label: req.body.format_group_label,
  };
  FormFormat.create(new_entry);

  setTimeout(() => res.redirect(`/form`), 200);
};

exports.fetch_data = (req, res) => {
  // TODO: make working with new label format
  Form.findAll().then((entries) => {
    let outdata = 'order,tracking,processed_by,added,cost,currency,support_id,group_label\n';
    entries.forEach((d) => {
      outdata += `${d.order},${d.tracking},${d.processed_by},${new Date(d.added_date).toDateString()},${d.cost},${d.currency},${
        d.support_id
      },${d.group_label}\n`;
    });

    // Return CSV data
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Azur_Lane_Bache_returns.csv"`);
    res.send(outdata);
  });
};

exports.delete = (req, res) => {
  FormV2.destroy({ where: { id: req.params.id } });
  setTimeout(() => res.redirect('/form'), 200);
};
