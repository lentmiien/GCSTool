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
  let title = `All_${Date.now()}`;
  const g_label = 'label' in req.query ? req.query.label : null;
  FormV2.findAll().then((entries) => {
    FormFormat.findAll().then((forms) => {
      // Set header row
      let outdata = 'order,processed_by,date,field1,field2,field3,field4,group_label\n';
      if (g_label) {
        forms.forEach((f) => {
          if (f.group_label == g_label) {
            outdata = `order,processed_by,date,${f.label1.toLowerCase().split(' ').join('_')},${f.label2
              .toLowerCase()
              .split(' ')
              .join('_')},${f.label3.toLowerCase().split(' ').join('_')},${f.label4.toLowerCase().split(' ').join('_')},group_label\n`;
            title = `${f.title.split(' ').join('_')}_${Date.now()}`;
          }
        });
      }

      // Fill in data
      entries.forEach((d) => {
        if (g_label == null || g_label == d.group_label) {
          outdata += `${d.order},${d.processed_by},${d.createdAt.toDateString()},${d.label1},${d.label2},${d.label3},${d.label4},${
            d.group_label
          }\n`;
        }
      });

      // Return CSV data
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${title}.csv"`);
      res.send(outdata);
    });
  });
};

exports.delete = (req, res) => {
  FormV2.destroy({ where: { id: req.params.id } });
  setTimeout(() => res.redirect('/form'), 200);
};
