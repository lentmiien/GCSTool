// Require necessary database models
const { Form } = require('../sequelize');

exports.index = (req, res) => {
  Form.findAll().then(entries => {
    res.render('form', {entries});
  });
};

exports.add_post = (req, res) => {
  const new_entry = {
    order: req.body.order,
    tracking: req.body.tracking,
    processed_by: res.locals.name,
    added_date: Date.now(),
    cost: req.body.cost,
    currency: req.body.currency,
    support_id: req.body.support_id,
    group_label: req.body.group_label,
  };
  Form.create(new_entry);

  setTimeout(() => res.redirect("/form"), 200);
};

exports.fetch_data = (req, res) => {
  Form.findAll().then(entries => {
    let outdata = "order,tracking,processed_by,added,cost,currency,support_id,group_label\n";
    entries.forEach(d => {
      outdata += `${d.order},${d.tracking},${d.processed_by},${(new Date(d.added_date)).toDateString()},${d.cost},${d.currency},${d.support_id},${d.group_label}\n`;
    });

    // Return CSV data
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Azur_Lane_Bache_returns.csv"`);
    res.send(outdata);
  });
};

exports.delete = (req, res) => {
  Form.destroy({ where: { id: req.params.id } });
  setTimeout(() => res.redirect("/form"), 200);
};
