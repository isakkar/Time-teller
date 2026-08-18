const TIMEZONE_MAP = {
  // US / Canada
  pt: 'America/Los_Angeles', pst: 'America/Los_Angeles', pdt: 'America/Los_Angeles',
  mt: 'America/Denver', mst: 'America/Denver', mdt: 'America/Denver',
  ct: 'America/Chicago', cst: 'America/Chicago', cdt: 'America/Chicago',
  et: 'America/New_York', est: 'America/New_York', edt: 'America/New_York',
  akst: 'America/Anchorage', akdt: 'America/Anchorage', hst: 'Pacific/Honolulu',

  // Europe / UK
  gmt: 'UTC', utc: 'UTC',
  bst: 'Europe/London',
  cet: 'Europe/Paris', cest: 'Europe/Paris',
  eet: 'Europe/Athens', eest: 'Europe/Athens',

  // Asia / Pacific
  jst: 'Asia/Tokyo',
  kst: 'Asia/Seoul',
  ist: 'Asia/Kolkata',
  sgt: 'Asia/Singapore',
  hkt: 'Asia/Hong_Kong',
  aest: 'Australia/Sydney', aedt: 'Australia/Sydney',
  acst: 'Australia/Adelaide', acdt: 'Australia/Adelaide',
  awst: 'Australia/Perth',
  nzst: 'Pacific/Auckland', nzdt: 'Pacific/Auckland',

  // South America
  brt: 'America/Sao_Paulo', brst: 'America/Sao_Paulo',
  art: 'America/Argentina/Buenos_Aires'
};

const inputEl = document.getElementById('time-input');
const pasteBtn = document.getElementById('paste-btn');
const timeDisplay = document.getElementById('converted-time');
const detailsDisplay = document.getElementById('converted-details');
const settingsBtn = document.getElementById('settings-btn');
const modal = document.getElementById('settings-modal');
const closeBtn = document.getElementById('close-modal-btn');
const timezoneSelect = document.getElementById('timezone-select');
const timezoneSearch = document.getElementById('timezone-search');

let targetZone = localStorage.getItem('targetZone') || 'system';

inputEl.addEventListener('input', processInput);

// On paste button click
pasteBtn.addEventListener('click', async () => {
  try {
    // Read text from clipboard
    const text = await navigator.clipboard.readText();
    // Set input value to clipboard text
    inputEl.value = text;
    // Trigger the conversion manually since setting value via JS doesn't fire 'input' event
    processInput();
  } catch (err) {
    detailsDisplay.textContent = 'Clipboard access denied or failed.';
    detailsDisplay.classList.add('error');
    console.error('Failed to read clipboard: ', err);
  }
});

// Initialize Searchable Timezone List
const allZones = Intl.supportedValuesOf('timeZone');

function renderTimezones(filterText = '') {
  timezoneSelect.innerHTML = ''; // Clear current options
  const lowerFilter = filterText.toLowerCase();

  // Add the Automatic option if it matches the search text
  if ('automatic (system default)'.includes(lowerFilter)) {
    const systemOpt = document.createElement('option');
    systemOpt.value = 'system';
    systemOpt.textContent = 'Automatic (System Default)';
    timezoneSelect.appendChild(systemOpt);
  }

  // Add matching timezones
  allZones.forEach(zone => {
    const label = zone.replace(/_/g, ' ');
    if (label.toLowerCase().includes(lowerFilter)) {
      const opt = document.createElement('option');
      opt.value = zone;
      opt.textContent = label;
      timezoneSelect.appendChild(opt);
    }
  });

  // Highlight current selection if it's visible in the filtered list
  if (Array.from(timezoneSelect.options).some(opt => opt.value === targetZone)) {
    timezoneSelect.value = targetZone;
  }
}

// Initial render
renderTimezones();

// Re-render list whenever the user types
timezoneSearch.addEventListener('input', (e) => {
  renderTimezones(e.target.value);
});

// Settings Modal Events
settingsBtn.addEventListener('click', () => modal.classList.remove('hidden'));
closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

// Update target timezone
timezoneSelect.addEventListener('change', (e) => {
  targetZone = e.target.value;
  localStorage.setItem('targetZone', targetZone);
  processInput(); // Recalculate immediately if there's text
});

function processInput() {
  const val = inputEl.value.trim();
  
  if (!val) { // No value
    timeDisplay.textContent = '--:--';
    detailsDisplay.textContent = 'Enter a timestamp above';
    detailsDisplay.classList.remove('error');
    return;
  }

  try {
    // Parse & convert
    const parsed = parseInput(val);
    const converted = convertToLocal(parsed);

    timeDisplay.textContent = converted.time;
    detailsDisplay.textContent = `${converted.date} (${converted.zone})`;
    detailsDisplay.classList.remove('error');
  } catch (err) { // Parsing error
    timeDisplay.textContent = '--:--';
    detailsDisplay.textContent = err.message;
    detailsDisplay.classList.add('error');
  }
}

function parseInput(inputStr) {
  // Regex matches: HH[:MM] [AM/PM] TIMEZONE
  const regex = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+([a-z]{2,5})\s*$/i;
  const match = inputStr.match(regex);
  if (!match) {
    throw new Error('Invalid format. Use e.g. "9:30 pm PT" or "14:55 CST"');
  }

  let [_, hrsStr, minsStr, ampm, tzCode] = match;
  let hrs = parseInt(hrsStr, 10);
  let mins = minsStr ? parseInt(minsStr, 10) : 0;
  ampm = ampm ? ampm.toLowerCase() : null;
  tzCode = tzCode.toLowerCase();

  if (hrs > 24 || mins > 59) { // Invalid numbers
    throw new Error('Invalid time values');
  }

  if (ampm) { // 12-hour values
    if (hrs > 12 || hrs < 1) throw new Error('Hour must be 1-12 when using AM/PM');
    if (ampm === 'pm' && hrs < 12) hrs += 12;
    if (ampm === 'am' && hrs === 12) hrs = 0;
  }

  const ianaZone = TIMEZONE_MAP[tzCode];
  if (!ianaZone) { // Invalid timezone code
    throw new Error(`Unrecognized timezone abbreviation "${tzCode.toUpperCase()}"`);
  }

  return { hrs, mins, ianaZone };
}

function convertToLocal({ hrs, mins, ianaZone }) {
  const DateTime = luxon.DateTime;
  
  // Create date object in target timezone for today's date
  const nowInTarget = DateTime.now().setZone(ianaZone);
  const targetDt = DateTime.fromObject(
    {
      year: nowInTarget.year,
      month: nowInTarget.month,
      day: nowInTarget.day,
      hour: hrs,
      minute: mins
    },
    { zone: ianaZone }
  );

  if (!targetDt.isValid) {
    throw new Error('Could not parse target date/time');
  }

  // Convert to user-selected zone (or system local)
  const outputDt = targetDt.setZone(targetZone);

  return {
    time: outputDt.toFormat('h:mm a'),
    date: outputDt.toFormat('EEE, MMM d, yyyy'),
    zone: outputDt.zoneName
  };
}