// SEC Leave Planner — attendance export bookmarklet (loaded by the tiny bookmarklet loader)
// Runs on learner.saveetha.in (same-origin), fetches attendance data, offers it for copy.
// ES5-ish: var + function (no arrows, no template literals) for maximum browser compatibility.
(function () {
  var TERM = 8;
  var BASE = '/academics/calculate-my-attendance';

  function hoursOf(timing) {
    if (!timing) return 2;
    if (timing.indexOf('MENTOR MEET') === 0) return 1.5;
    if (timing.indexOf('SWH') === 0) return 1;
    var m = timing.match(/CLS(\d+)-(\d+)/);
    if (m) return parseInt(m[2], 10) - parseInt(m[1], 10);
    return 2;
  }

  function toast(msg, color) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:' + (color || '#16a34a') + ';color:#fff;padding:12px 24px;border-radius:8px;' +
      'font-size:14px;font-weight:600;z-index:9999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
      'white-space:nowrap;max-width:90vw;text-align:center;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 8000);
  }

  function showTextarea(json) {
    var ta = document.createElement('textarea');
    ta.value = json;
    ta.style.cssText =
      'position:fixed;top:60px;left:10px;width:90vw;height:70vh;z-index:9999998;' +
      'font-size:11px;padding:8px;border:2px solid #333;background:#fff;color:#000;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, json.length);
    toast('JSON ready — press Ctrl+A then Ctrl+C, then paste in SEC Leave Planner', '#2563eb');
  }

  fetch(BASE + '/slots/?term_id=' + TERM)
    .then(function (r) {
      if (!r.ok) throw new Error('slots request failed: HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var requests = data.results.map(function (slot) {
        return fetch(BASE + '/?term_id=' + TERM + '&slot_id=' + slot.id + '&action=calculate')
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var rows = Array.prototype.slice.call(doc.querySelectorAll('table tbody tr'));
            var sessions = rows.map(function (row) {
              var cells = Array.prototype.slice.call(row.querySelectorAll('td')).map(function (td) {
                return (td.innerText || '').trim();
              });
              return {
                date: cells[0],
                time: cells[1],
                timing: cells[2] || '',
                location: cells[3],
                status: cells[4],
                calculation: cells[5]
              };
            });
            var present = sessions.filter(function (x) { return x.status === 'PRESENT'; });
            var conducted = sessions.filter(function (x) {
              return x.status === 'PRESENT' || x.status === 'ABSENT';
            });
            var code = slot.subject_code || '';
            return {
              slot: {
                id: slot.id,
                slotName: slot.slot_name,
                subjectCode: code,
                subjectName: slot.subject_name,
                isActivity: code.indexOf('ECA') === 0 || code.indexOf('SDCP') === 0
              },
              sessions: sessions.map(function (x) {
                return { date: x.date, time: x.time, timing: x.timing, location: x.location, status: x.status, calculation: x.calculation, hours: hoursOf(x.timing) };
              }),
              stats: {
                presentHours: present.reduce(function (a, x) { return a + hoursOf(x.timing); }, 0),
                totalHours: conducted.reduce(function (a, x) { return a + hoursOf(x.timing); }, 0),
                percentage: 0
              }
            };
          });
      });
      return Promise.all(requests);
    })
    .then(function (slots) {
      var m = document.body.innerText.match(/Ref2:\s*(\d+)/);
      var student = m ? m[1] : 'unknown';
      var data = {
        student: student,
        termId: TERM,
        fetchedAt: new Date().toISOString(),
        slots: slots
      };
      var json = JSON.stringify(data, null, 2);

      // Try the modern clipboard API first (works on HTTPS with user gesture).
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json)
          .then(function () {
            toast('Copied to clipboard! Paste in SEC Leave Planner (' + slots.length + ' subjects)');
          })
          .catch(function () {
            showTextarea(json);
          });
      } else {
        showTextarea(json);
      }
    })
    .catch(function (e) {
      toast('SEC Attendance: error — ' + e.message, '#dc2626');
    });
})();