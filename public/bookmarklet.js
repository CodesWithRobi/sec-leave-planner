// SEC Leave Planner — attendance export bookmarklet (loaded by the tiny bookmarklet loader)
// Runs on learner.saveetha.in (same-origin), fetches attendance data, offers it for copy.
// ES5-ish: var + function (no arrows, no template literals) for maximum browser compatibility.
(function () {
  // Immediate feedback + re-entry guard: say something the instant the script
  // runs, and refuse to start twice so double-clicks can't fire duplicate
  // fetches / toasts / clipboard writes.
  if (window.__SEC_ATT_ACTIVE__) {
    var dup = document.createElement('div');
    dup.textContent = 'SEC Attendance: already running — wait for the result';
    dup.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
      'background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;' +
      'font-size:14px;font-weight:600;z-index:9999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
      'white-space:nowrap;max-width:90vw;text-align:center;';
    document.body.appendChild(dup);
    setTimeout(function () { dup.remove(); }, 3000);
    return;
  }
  window.__SEC_ATT_ACTIVE__ = true;
  // Safety: if the run hangs somehow, let the next click start fresh.
  setTimeout(function () { window.__SEC_ATT_ACTIVE__ = false; }, 45000);

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

  // Portal dates look like "17 Jul 2026" → "2026-07-17" (ISO compare is fine).
  var MONTHS = { 'Jan':'01','Feb':'02','Mar':'03','Apr':'04','May':'05','Jun':'06',
    'Jul':'07','Aug':'08','Sep':'09','Oct':'10','Nov':'11','Dec':'12' };
  function isoDate(d) {
    var m = /(\d+)\s+(\w+)\s+(\d{4})/.exec(d || '');
    if (m) return m[3] + '-' + (MONTHS[m[2]] || '01') + '-' + ('0' + m[1]).slice(-2);
    return d || '';
  }
  // Circular 139: from 2026-08-31 a 2-hour class counts as 1.5h.
  function hoursFor(timing, dateStr) {
    var h = hoursOf(timing);
    if (h === 2 && isoDate(dateStr) >= '2026-08-31') return 1.5;
    return h;
  }

  // Single reusable toast element — updated in place, no stacking.
  var toastEl = null;
  function toast(msg, color, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText =
        'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
        'color:#fff;padding:12px 24px;border-radius:8px;' +
        'font-size:14px;font-weight:600;z-index:9999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
        'white-space:nowrap;max-width:90vw;text-align:center;' +
        'transition:background .2s;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.background = color || '#16a34a';
    if (toastEl._hideTimer) clearTimeout(toastEl._hideTimer);
    if (ms) {
      toastEl._hideTimer = setTimeout(function () {
        if (toastEl) { toastEl.remove(); toastEl = null; }
      }, ms);
    }
  }

  function done() {
    window.__SEC_ATT_ACTIVE__ = false;
  }

  // Immediate "it started" feedback — appears before any network round-trip.
  toast('SEC Attendance: extracting attendance…', '#2563eb');

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
    toast('JSON ready — press Ctrl+A then Ctrl+C, then paste in SEC Leave Planner', '#2563eb', 8000);
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
                return { date: x.date, time: x.time, timing: x.timing, location: x.location, status: x.status, calculation: x.calculation, hours: hoursFor(x.timing, x.date) };
              }),
              stats: {
                presentHours: present.reduce(function (a, x) { return a + hoursFor(x.timing, x.date); }, 0),
                totalHours: conducted.reduce(function (a, x) { return a + hoursFor(x.timing, x.date); }, 0),
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
            toast('Copied to clipboard! Paste in SEC Leave Planner (' + slots.length + ' subjects)', '#16a34a', 8000);
            done();
          })
          .catch(function () {
            showTextarea(json);
            done();
          });
      } else {
        showTextarea(json);
        done();
      }
    })
    .catch(function (e) {
      toast('SEC Attendance: error — ' + e.message, '#dc2626', 8000);
      done();
    });
})();