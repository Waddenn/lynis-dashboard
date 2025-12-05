document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const dashboard = document.getElementById('dashboard');
    const resetBtn = document.getElementById('reset-btn');
    const scoreCircle = document.querySelector('.progress-ring__circle');

    // Constants
    const radius = scoreCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;

    // Setup Score Ring
    scoreCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    scoreCircle.style.strokeDashoffset = circumference;

    // --- AI Settings & Modals ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const analysisModal = document.getElementById('analysis-modal');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const apiKeyInput = document.getElementById('api-key');
    const modelNameInput = document.getElementById('model-name');
    const closeButtons = document.querySelectorAll('.close-modal');

    // Load saved settings
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) apiKeyInput.value = savedKey;

    const savedModel = localStorage.getItem('gemini_model');
    if (savedModel) modelNameInput.value = savedModel;

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
            analysisModal.classList.add('hidden');
        });
    });

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const model = modelNameInput.value.trim() || 'gemini-1.5-flash';

        if (key) {
            localStorage.setItem('gemini_api_key', key);
            localStorage.setItem('gemini_model', model);
            alert('Settings saved!');
            settingsModal.classList.add('hidden');
        } else {
            alert('Please enter a valid API key.');
        }
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
        if (e.target === analysisModal) analysisModal.classList.add('hidden');
    });

    function setScore(percent) {
        const offset = circumference - (percent / 100) * circumference;
        scoreCircle.style.strokeDashoffset = offset;

        // Color based on score
        let color = '#ef4444'; // Red
        if (percent > 60) color = '#f59e0b'; // Orange
        if (percent > 80) color = '#22c55e'; // Green
        scoreCircle.style.stroke = color;

        // Animate counter
        animateValue("score-value", 0, percent, 1000);
    }

    function animateValue(id, start, end, duration) {
        if (isNaN(end)) end = 0;
        const obj = document.getElementById(id);
        const range = end - start;
        let current = start;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / range));

        const timer = setInterval(() => {
            current += increment;
            obj.innerHTML = current;
            if (current == end) {
                clearInterval(timer);
            }
        }, stepTime || 10); // fallback for 0 range
    }

    // Drag & Drop Handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        document.querySelector('.upload-content').classList.add('dragover');
    }

    function unhighlight(e) {
        document.querySelector('.upload-content').classList.remove('dragover');
    }

    uploadZone.addEventListener('drop', handleDrop, false);
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    resetBtn.addEventListener('click', () => location.reload());

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.dat') || file.name.includes('lynis')) {
                readFile(file);
            } else {
                alert('Please upload a valid Lynis report file (.dat)');
            }
        }
    }

    function readFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            parseReport(content);
            showDashboard();
        };
        reader.readAsText(file);
    }

    function showDashboard() {
        uploadZone.classList.add('hidden');
        setTimeout(() => {
            dashboard.classList.remove('hidden');
            document.querySelector('.app-footer').classList.remove('hidden');
        }, 300);
    }

    // Tab Switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    // --- Parsing Logic ---

    window.parseReport = parseReport; // Expose for debugging

    // Search Input Listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => filterFindings(e.target.value));
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Press '/' to focus search
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput?.focus();
        }

        // Press 'Esc' to clear search
        if (e.key === 'Escape') {
            if (document.activeElement === searchInput) {
                searchInput.blur();
            }
            if (searchInput && searchInput.value !== '') {
                searchInput.value = '';
                filterFindings('');
            }
        }
    });

    function parseReport(text) {
        try {
            const lines = text.split('\n');
            const data = {
                warnings: [],
                suggestions: [],
                systemInfo: {},
                score: 0
            };

            lines.forEach(line => {
                if (!line.includes('=') || line.startsWith('#')) return;

                if (line.includes('[]=')) {
                    const [keyPart, val] = line.split('[]=');
                    const key = keyPart.trim();
                    const value = val.trim();

                    if (key === 'warning' || key === 'suggestion') {
                        const parts = value.split('|');
                        const item = {
                            test: parts[0],
                            msg: parts[1],
                            category: parts[0].split('-')[0] || 'GENERAL'
                        };

                        if (key === 'warning') data.warnings.push(item);
                        else data.suggestions.push(item);
                    }
                } else {
                    const [key, ...rest] = line.split('=');
                    const value = rest.join('=').trim();

                    if (key === 'hardening_index') {
                        data.score = parseInt(value, 10);
                    } else if (['os_name', 'os_version', 'hostname', 'lynis_version', 'report_datetime_start'].includes(key)) {
                        data.systemInfo[key] = value;
                    } else if (key === 'tests_executed') {
                        const tests = value.split('|').filter(t => t.trim().length > 0);
                        data.testCount = tests.length;
                    }
                }
            });

            // Sort by category
            data.warnings.sort((a, b) => a.category.localeCompare(b.category));
            data.suggestions.sort((a, b) => a.category.localeCompare(b.category));

            renderData(data);
        } catch (e) {
            console.error(e);
            alert('Error parsing report: ' + e.message);
        }
    }

    function renderData(data) {
        setScore(data.score || 0);

        document.getElementById('count-warnings').textContent = data.warnings.length;
        document.getElementById('count-suggestions').textContent = data.suggestions.length;
        document.getElementById('count-passed').textContent = data.testCount || '-';

        const meta = document.getElementById('meta-info');
        meta.innerHTML = `
            ${data.systemInfo.report_datetime_start || 'Unknown Date'} | 
            ${data.systemInfo.hostname || 'Localhost'}
        `;

        renderList('warnings-panel', data.warnings, 'warning', data.systemInfo);
        renderList('suggestions-panel', data.suggestions, 'suggestion', data.systemInfo);
        renderChart(data);

        const sysGrid = document.getElementById('system-grid');
        sysGrid.innerHTML = `
            <div class="info-card"><small>OS Name</small><strong>${data.systemInfo.os_name || 'N/A'}</strong></div>
            <div class="info-card"><small>OS Version</small><strong>${data.systemInfo.os_version || 'N/A'}</strong></div>
            <div class="info-card"><small>Hostname</small><strong>${data.systemInfo.hostname || 'N/A'}</strong></div>
            <div class="info-card"><small>Lynis Version</small><strong>${data.systemInfo.lynis_version || 'N/A'}</strong></div>
            <div class="info-card"><small>Scan Date</small><strong>${data.systemInfo.report_datetime_start || 'N/A'}</strong></div>
        `;

        lucide.createIcons();
    }

    let findingsChart = null;

    function renderChart(data) {
        const ctx = document.getElementById('findingsChart').getContext('2d');

        // Aggregate categories
        const categories = {};
        [...data.warnings, ...data.suggestions].forEach(item => {
            categories[item.category] = (categories[item.category] || 0) + 1;
        });

        const labels = Object.keys(categories);
        const values = Object.values(categories);

        if (findingsChart) {
            findingsChart.destroy();
        }

        findingsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Too clustered for small chart
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` ${context.label}: ${context.raw}`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    function renderList(elementId, items, type, systemInfo) {
        const pan = document.getElementById(elementId);
        if (items.length === 0) {
            pan.innerHTML = `<div class="empty-state">No ${type}s found.</div>`;
            return;
        }

        let html = '';
        let lastCat = '';

        items.forEach(item => {
            if (item.category !== lastCat) {
                html += `<div class="category-header">${item.category}</div>`;
                lastCat = item.category;
            }

            html += `
                <div class="finding-item ${type}">
                    <div class="icon"><i data-lucide="${type === 'warning' ? 'alert-triangle' : 'lightbulb'}"></i></div>
                    <div class="finding-content">
                        <h4>${item.msg}</h4>
                        <span class="finding-details">
                            Test ID: <a href="https://cisofy.com/lynis/controls/${item.test}/" target="_blank">${item.test}</a>
                        </span>
                        <button class="ai-btn" onclick="analyzeFinding('${item.msg.replace(/'/g, "\\'")}', '${item.test}', '${item.category}', '${(systemInfo?.os_name || 'Linux').replace(/'/g, "\\'")}')">
                            <i data-lucide="sparkles"></i> Analyze with Gemini
                        </button>
                    </div>
                </div>
            `;
        });

        pan.innerHTML = html;
    }

    function filterFindings(query) {
        const term = query.toLowerCase();
        document.querySelectorAll('.finding-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        // Hide headers if no children visible
        document.querySelectorAll('.category-header').forEach(header => {
            let next = header.nextElementSibling;
            let hasVisible = false;
            while (next && !next.classList.contains('category-header')) {
                if (next.style.display !== 'none') hasVisible = true;
                next = next.nextElementSibling;
            }
            header.style.display = hasVisible ? 'flex' : 'none';
        });
    }

    const demoBtn = document.getElementById('demo-btn');

    if (demoBtn) {
        demoBtn.addEventListener('click', loadDemoData);
    }

    function loadDemoData() {
        // Sample report data for demonstration
        const demoReport = `
report_datetime_start=2025-12-05 09:41:09
os_name=Ubuntu Linux (Demo)
os_version=24.04 LTS
hostname=demo-server-prod-01
lynis_version=3.1.6
hardening_index=72
suggestion[]=BOOT-5264|Harden system services (systemd)|
suggestion[]=KRNL-5820|Disable core dump for all users|
suggestion[]=SSH-7408|Consider hardening SSH configuration|
suggestion[]=PHP-2372|Disable 'expose_php' in php.ini|
warning[]=FIRE-4502|Check firewall configuration (no active rules found)|
warning[]=HRDN-7222|Compiler found on production system|
tests_executed=TEST-1|TEST-2|TEST-3|TEST-4|TEST-5|
finish=true
        `;
        parseReport(demoReport);
        showDashboard();
    }

    // --- AI Logic ---
    const analysisLoader = document.createElement('div');
    analysisLoader.className = 'loading-spinner';
    analysisLoader.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Analyzing...';

    window.analyzeFinding = async function (msg, testId, category, osName) {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            document.getElementById('settings-btn').click();
            alert('Please authorize Gemini first (Enter API Key).');
            return;
        }

        const modal = document.getElementById('analysis-modal');
        const content = document.getElementById('analysis-content');

        // Clear previous content
        content.innerHTML = '';
        analysisLoader.classList.remove('hidden');
        content.appendChild(analysisLoader);

        modal.classList.remove('hidden');

        const prompt = `
        As a Security Expert, provide a QUICK fix for this Lynis finding on ${osName}:
        "${msg}" (Test: ${testId})
        
        Rules:
        1. MAX 2 sentences for explanation.
        2. Provide ONLY the specific command to fix/check.
        3. No intro/outro. Keep it short.
        Format: Markdown.`;

        try {
            const model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();

            // Remove spinner completely
            if (content.contains(analysisLoader)) {
                content.removeChild(analysisLoader);
            }

            if (data.error) {
                content.innerHTML = `<div class="ai-response text-danger"><strong>Error:</strong> ${data.error.message}</div>`;
            } else {
                const text = data.candidates[0].content.parts[0].text;
                // Enhanced Markdown Parsing with Copy Button
                let html = text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/```([\s\S]*?)```/g, (match, code) => {
                        return `
                            <div class="code-block-wrapper">
                                <pre><code>${code.trim()}</code></pre>
                                <button class="copy-btn" onclick="copyCode(this)" title="Copy Command">
                                    <i data-lucide="copy"></i>
                                </button>
                            </div>
                        `;
                    })
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\n\n/g, '<br><br>')
                    .replace(/\n/g, '<br>');

                content.innerHTML = `<div class="ai-response">${html}</div>`;
                lucide.createIcons();
            }

        } catch (e) {
            if (content.contains(analysisLoader)) content.removeChild(analysisLoader);
            content.innerHTML = `<div class="ai-response text-danger"><strong>Network Error:</strong> ${e.message}</div>`;
        }
    };

    window.copyCode = function (btn) {
        const code = btn.parentElement.querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i>';
            lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = originalIcon;
                lucide.createIcons();
            }, 2000);
        });
    };

});
