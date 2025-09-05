// UI active state handling
function setActive(buttonId) {
	const allButtons = ['btn-verse', 'btn-devotional', 'btn-calendar'];
	allButtons.forEach(id => {
		const btn = document.getElementById(id);
		if (!btn) return;
		btn.classList.remove('bg-white', 'text-indigo-700', 'shadow-lg');
		btn.classList.add('text-white/90');
	});
	const active = document.getElementById(buttonId);
	if (active) {
		active.classList.remove('text-white/90');
		active.classList.add('bg-white', 'text-indigo-700', 'shadow-lg');
	}
}

// Tab switching
function showContent(section) {
	['verse','devotional','calendar'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.classList.add('hidden');
	});
	const target = document.getElementById(section);
	if (target) target.classList.remove('hidden');
	setActive('btn-' + section);

	if (section === 'verse') {
		maybeFetchVerse();
	} else if (section === 'devotional') {
		maybeBuildDevotional();
	} else if (section === 'calendar') {
		maybeBuildCalendar();
	}
}

// API key placeholder for future provider (kept as requested)
const OPENBIBLE_API_KEY = '7688c418d97e46a501594c66132865ee';
// Gemini API key for devotional generation (as requested)
const GEMINI_API_KEY = 'AIzaSyA8Awogtw-9quQTk1sjmVoY6G9FHL7tHfo';

// Fetch multiple verses (aim for 6) with fallback
async function fetchSixVerses() {
	try {
		const res = await fetch('https://labs.bible.org/api/?passage=random&type=json&formatting=plain');
		if (res.ok) {
			const first = await res.json();
			const items = Array.isArray(first) ? first : [];
			const more = await Promise.all(
				Array.from({ length: 5 }).map(async () => {
					try {
						const r = await fetch('https://labs.bible.org/api/?passage=random&type=json&formatting=plain');
						if (r.ok) {
							const d = await r.json();
							if (Array.isArray(d) && d[0]) return d[0];
						}
					} catch (_) {}
					return null;
				})
			);
			const verses = [...items, ...more.filter(Boolean)].slice(0, 6).map(v => ({
				text: v.text,
				reference: `${v.bookname} ${v.chapter}:${v.verse}`
			}));
			if (verses.length > 0) return verses;
		}
	} catch (_) {}

	return Array.from({ length: 6 }).map(() => ({
		text: 'For God so loved the world, that he gave his only Son... ',
		reference: 'John 3:16'
	}));
}

let versesLoaded = false;
let fetchedVerses = [];
async function maybeFetchVerse() {
	if (versesLoaded) return;
	const list = document.getElementById('versesList');
	if (!list) return;
	list.innerHTML = '<p class="text-white/95 text-lg">Loading verses...</p>';

	try {
		const verses = await fetchSixVerses();
		list.innerHTML = '';
		verses.forEach(({ text, reference }) => {
			const item = document.createElement('div');
			item.className = 'rounded-xl bg-white/10 ring-1 ring-white/20 p-4';
			const p = document.createElement('p');
			p.className = 'text-white/95';
			p.textContent = `“${text}”`;
			const ref = document.createElement('p');
			ref.className = 'text-white/80 text-sm mt-1';
			ref.textContent = reference || '';
			item.appendChild(p);
			item.appendChild(ref);
			list.appendChild(item);
		});
		versesLoaded = true;
		fetchedVerses = verses;
	} catch (_) {
		list.innerHTML = '<p class="text-white/95 text-lg">Unable to load verses right now.</p>';
	}
}

// Build devotional content using the first available verse
let devotionalBuilt = false;
function maybeBuildDevotional() {
	if (devotionalBuilt) return;
	const verseObj = fetchedVerses && fetchedVerses.length > 0 ? fetchedVerses[0] : null;
	const verseText = verseObj ? verseObj.text : 'For God so loved the world that He gave His only Son.';
	const reference = verseObj ? verseObj.reference : 'John 3:16';

	const refLine = document.getElementById('devoVerseRefLine');
	const obsEl = document.getElementById('devoObservation');
	const appEl = document.getElementById('devoApplication');
	const prayEl = document.getElementById('devoPrayer');
	if (!refLine || !obsEl || !appEl || !prayEl) return;

	refLine.textContent = `Verse: "${verseText}" — ${reference}`;

	// Loading placeholders
	obsEl.textContent = 'Generating observation...';
	appEl.textContent = 'Generating application...';
	prayEl.textContent = 'Generating prayer...';

	generateDevotionalWithGemini(verseText, reference)
		.then(({ observation, application, prayer }) => {
			obsEl.textContent = observation || '—';
			appEl.textContent = application || '—';
			prayEl.textContent = prayer || '—';
			devotionalBuilt = true;
		})
		.catch(() => {
			obsEl.textContent = `This verse reminds us of God's heart and His unchanging truth. It reveals His purpose and the hope He offers to us.`;
			appEl.textContent = `Today, I will let this truth shape my choices and words. I will practice kindness, patience, and trust in God in my relationships and work.`;
			prayEl.textContent = `Father, thank You for Your Word and its encouragement. Help me to live this truth today with faith and love. In Jesus’ name, Amen.`;
			devotionalBuilt = true;
		});
}

// Build calendar based on current "Bible season" determined by Gemini and the fetched verses
let calendarBuilt = false;
async function maybeBuildCalendar() {
	if (calendarBuilt) return;
	const seasonEl = document.getElementById('calendarSeason');
	const summaryEl = document.getElementById('calendarSummary');
	const listEl = document.getElementById('calendarList');
	if (!seasonEl || !summaryEl || !listEl) return;

	seasonEl.textContent = 'Determining season...';
	summaryEl.textContent = '';
	listEl.innerHTML = '';

	// Ensure verses are fetched for use in the calendar
	if (!versesLoaded) {
		await maybeFetchVerse();
	}

	try {
		const { season, summary } = await determineBibleSeasonWithGemini(fetchedVerses);
		seasonEl.textContent = season || 'Season';
		summaryEl.textContent = summary || '';

		// Render the same six verses as suggested readings for the season
		listEl.innerHTML = '';
		(fetchedVerses || []).forEach(({ text, reference }) => {
			const item = document.createElement('div');
			item.className = 'rounded-xl bg-white/10 ring-1 ring-white/20 p-4';
			const p = document.createElement('p');
			p.className = 'text-white/95';
			p.textContent = `“${text}”`;
			const ref = document.createElement('p');
			ref.className = 'text-white/80 text-sm mt-1';
			ref.textContent = reference || '';
			item.appendChild(p);
			item.appendChild(ref);
			listEl.appendChild(item);
		});

		calendarBuilt = true;
	} catch (_) {
		seasonEl.textContent = 'Season (fallback)';
		summaryEl.textContent = 'Reflect on God’s faithfulness in every season.';
	}
}

// Ask Gemini for a current Bible season label and summary
async function determineBibleSeasonWithGemini(verses) {
	const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
	const today = new Date().toISOString().split('T')[0];
	const versesStr = (verses || []).map(v => `- ${v.reference}: ${v.text}`).join('\n');
	const prompt = (
		`Today is ${today}. Based on the traditional Christian year (e.g., Advent, Christmas, Epiphany, Lent, Holy Week, Eastertide, Pentecost, Ordinary Time), ` +
		`determine the most fitting current season. Then, in one short paragraph, summarize how this season focuses our reading of Scripture. ` +
		`Also consider these sample verses for thematic alignment:\n${versesStr}\n\n` +
		`Output strictly as compact JSON with keys: season (short label), summary (1–3 sentences). No extra commentary.`
	);

	const res = await fetch(`${endpoint}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
	});
	if (!res.ok) throw new Error('Gemini season request failed');
	const data = await res.json();
	const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
	if (!text) throw new Error('Empty Gemini season response');
	const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
	const parsed = JSON.parse(cleaned);
	return { season: String(parsed.season || '').trim(), summary: String(parsed.summary || '').trim() };
}

// Use Gemini to generate Observation, Application, Prayer as JSON for reliable parsing
async function generateDevotionalWithGemini(verseText, reference) {
	const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
	const prompt = (
		`You are writing a short daily Christian devotional.\n\n` +
		`Verse: "${verseText}" — ${reference}\n\n` +
		`Please generate the following in clear, simple, and encouraging language (faithful to the Bible):\n` +
		`1. Observation (2–4 sentences)\n` +
		`2. Application (2–4 sentences)\n` +
		`3. Prayer (2–4 sentences)\n\n` +
		`Output strictly as compact JSON with keys: observation, application, prayer. No extra commentary.`
	);

	const res = await fetch(`${endpoint}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			contents: [
				{
					parts: [
						{ text: prompt }
					]
				}
			]
		})
	});

	if (!res.ok) throw new Error('Gemini request failed');
	const data = await res.json();
	const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
	if (!text) throw new Error('Empty Gemini response');

	// Try to parse JSON; if wrapped in markdown, strip code fences
	const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
	const parsed = JSON.parse(cleaned);
	return {
		observation: String(parsed.observation || '').trim(),
		application: String(parsed.application || '').trim(),
		prayer: String(parsed.prayer || '').trim()
	};
}

// Init
document.addEventListener('DOMContentLoaded', () => {
	showContent('verse');
	maybeFetchVerse();
});
