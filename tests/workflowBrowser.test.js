/** @jest-environment jsdom */
const fs = require('fs');
const pug = require('pug');
const script = fs.readFileSync('public/javascripts/workflows.js', 'utf8');
const users = [{ id: 1, userid: 'Alice' }, { id: 2, userid: 'Bob' }];
const def = { id: 1, name: 'GST', description: 'Quarterly', trigger: 'manual', enabled: true, locked: false, archived: false, revision: 0,
  steps: [{ id: 'first', title: 'Gather data', description: 'Read instructions', assignees: [1], archived: false }],
  requiredVariables: [{ name: 'Order', defaultValue: '' }] };
const locals = { currentPath: '/workflows', role: 'admin', name: 'Alice', workflowUser: users[0], isWorkflowAdmin: true,
  workflowCsrf: 'test', formatWorkflowDate: () => '26/10/2026', users, def };

function mount(page, extra = {}) {
  document.documentElement.innerHTML = pug.renderFile(`views/workflows/${page}.pug`, { ...locals, ...extra });
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.eval(script);
}
function submit(form, button) {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'submitter', { value: button });
  form.dispatchEvent(event);
  return event;
}

test('editor supports ordering, new tasks, required variables and weekly schedules without losing task identities', () => {
  mount('editor');
  document.querySelector('[data-add-step]').click();
  const added = document.querySelectorAll('[data-step-row]')[1];
  added.querySelector('[data-field="title"]').value = 'Confirm';
  added.querySelector('[data-field="description"]').value = 'Confirm data';
  added.querySelector('[data-assignee][value="2"]').checked = true;
  added.querySelector('[data-move="up"]').click();
  expect(document.querySelector('[data-step-row] legend').textContent).toBe('Task 1');
  document.querySelector('[data-trigger]').value = 'scheduled';
  document.querySelector('[data-schedule-field="frequency"]').value = 'weekly';
  document.querySelector('[data-trigger]').dispatchEvent(new Event('change', { bubbles: true }));
  expect(document.querySelector('[data-schedule]').hidden).toBe(false);
  expect(document.querySelector('[data-field="defaultValue"]').required).toBe(true);
  document.querySelector('[data-field="defaultValue"]').value = '{date}';
  const form = document.querySelector('[data-editor]');
  submit(form);
  const steps = JSON.parse(form.elements.steps.value);
  expect(steps.map(step => step.title)).toEqual(['Confirm', 'Gather data']);
  expect(steps[0].assignees).toEqual([2]);
  expect(steps[1].id).toBe('first');
  expect(JSON.parse(form.elements.requiredVariables.value)).toEqual([{ name: 'Order', defaultValue: '{date}' }]);
  expect(JSON.parse(form.elements.schedule.value).weekdays).toEqual([1]);
});

test('manual starts serialize required and custom variables, and reject incomplete custom pairs', () => {
  mount('definition', { startKey: 'start-key' });
  const form = document.querySelector('[data-variable-form]');
  form.querySelector('[data-required-value]').value = '1234';
  expect(form.querySelectorAll('[data-custom-row]')).toHaveLength(0);
  form.querySelector('[data-add-custom]').click();
  form.querySelector('[data-custom-name]').value = 'Country';
  expect(submit(form).defaultPrevented).toBe(true);
  form.querySelector('[data-custom-value]').value = 'Australia';
  expect(submit(form).defaultPrevented).toBe(false);
  expect(JSON.parse(form.elements.values.value)).toEqual(['1234']);
  expect(JSON.parse(form.elements.custom.value)).toEqual([{ name: 'Country', value: 'Australia' }]);
  expect(form.elements.startKey.value).toBe('start-key');
});

test('task comments are escaped, rejection requires an error and completion can clear an old comment', () => {
  const task = { id: 1, position: 1, title: 'Check', description: 'Review', comment: '<script>unsafe()</script>', runId: 'run',
    run: { id: 'run', name: 'GST', variables: [{ name: 'Order', value: '<b>1234</b>', required: true }], revision: 4 } };
  mount('tasks', { tasks: [task], starters: [], comments: [task, { ...task, id: 2, position: 0 }] });
  expect(document.querySelector('.workflow-comments script')).toBeNull();
  expect(document.querySelector('.workflow-comments p').textContent).toBe('<script>unsafe()</script>');
  expect(document.querySelector('.workflow-comments').open).toBe(false);
  expect(document.querySelectorAll('.workflow-comments article')).toHaveLength(1);
  expect(document.querySelector('.workflow-variable-fields b')).toBeNull();
  expect(document.querySelector('[data-required-value]').value).toBe('<b>1234</b>');
  const form = document.querySelector('.workflow-action');
  form.elements.comment.value = '';
  form.elements.comment.reportValidity = jest.fn();
  expect(submit(form, form.querySelector('[value="reject"]')).defaultPrevented).toBe(true);
  expect(submit(form, form.querySelector('[value="complete"]')).defaultPrevented).toBe(false);
});

test('task forms submit variable corrections and the comment together and show edit attribution', () => {
  const task = { id: 1, position: 1, title: 'Check', description: 'Review', comment: 'Earlier note', runId: 'run',
    run: { id: 'run', name: 'GST', revision: 4, variables: [
      { name: 'Order', value: '1234', required: true, editedBy: 'Bob', editedAt: '2026-10-26T01:00:00.000Z' },
      { name: 'Country', value: 'AU', required: false },
    ] } };
  mount('tasks', { tasks: [task], starters: [], comments: [] });
  const form = document.querySelector('.workflow-action');
  expect(form.querySelector('[type="submit"]').disabled).toBe(false);
  expect(form.textContent).toContain('Edited by Bob · 26/10/2026 JST');
  expect(form.textContent).toContain('Edit history unavailable');
  form.querySelector('[data-required-value]').value = '5678';
  form.querySelector('[data-custom-value]').value = 'NZ';
  form.elements.comment.value = 'Corrected the order and country';
  expect(submit(form, form.querySelector('[value="reject"]')).defaultPrevented).toBe(false);
  const payload = new FormData(form);
  expect(JSON.parse(payload.get('values'))).toEqual(['5678']);
  expect(JSON.parse(payload.get('custom'))).toEqual([{ name: 'Country', value: 'NZ' }]);
  expect(payload.get('comment')).toBe('Corrected the order and country');
  expect(payload.get('revision')).toBe('4');
});

test('custom variables are added on demand, limited to three, and can be removed', () => {
  mount('definition', { startKey: 'start-key' });
  const form = document.querySelector('[data-variable-form]');
  const add = form.querySelector('[data-add-custom]');
  for (let i = 0; i < 3; i++) add.click();
  expect(add.hidden).toBe(true);
  add.click();
  expect(form.querySelectorAll('[data-custom-row]')).toHaveLength(3);
  form.querySelector('[data-remove-custom]').click();
  expect(add.hidden).toBe(false);
  expect(form.querySelectorAll('[data-custom-row]')).toHaveLength(2);
});

test('the Today panel shows only a positive workflow task count and links to My tasks', () => {
  const render = count => pug.renderFile('views/workflows/definitions.pug', { ...locals, definitions: [], workflowTaskCount: count,
    workschedule: { days: [{ date: '2026-10-26' }, { date: '2026-10-27' }] } });
  document.documentElement.innerHTML = render(3);
  const reminders = document.querySelectorAll('.app-schedule-task[href="/workflows"]');
  expect(reminders).toHaveLength(1);
  expect(reminders[0].textContent).toBe('3 workflow tasks');
  document.documentElement.innerHTML = render(0);
  expect(document.querySelector('.app-schedule-task[href="/workflows"]')).toBeNull();
});
