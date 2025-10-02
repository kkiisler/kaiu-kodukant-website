// Admin Dashboard JavaScript

let token = localStorage.getItem('adminToken') || getCookie('adminToken');
let currentFilter = 'all';
let submissions = [];

// Load initial data
window.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadSubmissions('all');
});

async function loadStatistics() {
    try {
        const response = await fetch('/api/v1/admin/statistics', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            throw new Error('Failed to load statistics');
        }

        const data = await response.json();
        updateStatistics(data.statistics);
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function updateStatistics(stats) {
    document.getElementById('membershipCount').textContent = stats.total.membership;
    document.getElementById('contactCount').textContent = stats.total.contact;
    document.getElementById('totalCount').textContent = stats.total.membership + stats.total.contact;
    document.getElementById('membershipRecent').textContent = stats.recent.membership;
    document.getElementById('contactRecent').textContent = stats.recent.contact;
}

async function loadSubmissions(type = 'all') {
    currentFilter = type;

    try {
        const response = await fetch(`/api/v1/admin/submissions?type=${type}&limit=100`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            throw new Error('Failed to load submissions');
        }

        const data = await response.json();
        submissions = data.submissions;
        renderSubmissions(submissions);
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

function renderSubmissions(submissions) {
    const tbody = document.getElementById('submissionsTable');
    const noSubmissions = document.getElementById('noSubmissions');

    if (submissions.length === 0) {
        tbody.innerHTML = '';
        noSubmissions.classList.remove('hidden');
        return;
    }

    noSubmissions.classList.add('hidden');

    tbody.innerHTML = submissions.map(submission => {
        const date = new Date(submission.submitted_at).toLocaleString('et-EE');
        const type = submission.type === 'membership' ? 'Liikmestaotlus' : 'Kontaktivorm';
        const typeColor = submission.type === 'membership' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
        const score = submission.recaptcha_score || 0;
        const scoreColor = score >= 0.7 ? 'text-green-600' : score >= 0.5 ? 'text-yellow-600' : 'text-red-600';

        // Content display
        let content = '';
        if (submission.type === 'contact') {
            content = submission.subject ? `<strong>${escapeHtml(submission.subject)}</strong><br>` : '';
            const preview = submission.message ? submission.message.substring(0, 100) : '';
            content += `<span class="text-gray-600">${escapeHtml(preview)}${submission.message && submission.message.length > 100 ? '...' : ''}</span>`;
            if (submission.message && submission.message.length > 100) {
                content += ` <button onclick="showMessage('${encodeURIComponent(JSON.stringify(submission))}')" class="text-blue-600 hover:text-blue-700 text-sm">Vaata</button>`;
            }
        }

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${date}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeColor}">
                        ${type}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${escapeHtml(submission.name)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <a href="mailto:${escapeHtml(submission.email)}" class="text-blue-600 hover:text-blue-700">
                        ${escapeHtml(submission.email)}
                    </a>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900">
                    ${content}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${scoreColor}">
                    ${score.toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button onclick="deleteSubmission('${submission.type}', ${submission.id})"
                            class="text-red-600 hover:text-red-700">
                        Kustuta
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterSubmissions(type) {
    // Update tab styling
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Load filtered submissions
    loadSubmissions(type);
}

async function deleteSubmission(type, id) {
    if (!confirm('Kas oled kindel, et soovid selle taotluse kustutada?')) {
        return;
    }

    try {
        const response = await fetch(`/api/v1/admin/submission/${type}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Reload submissions
            loadSubmissions(currentFilter);
            loadStatistics();
        } else {
            alert('Kustutamine ebaõnnestus');
        }
    } catch (error) {
        console.error('Error deleting submission:', error);
        alert('Kustutamine ebaõnnestus');
    }
}

function showMessage(encodedData) {
    const submission = JSON.parse(decodeURIComponent(encodedData));
    const modal = document.getElementById('messageModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <div class="space-y-4">
            <div>
                <strong>Saatja:</strong> ${escapeHtml(submission.name)}
            </div>
            <div>
                <strong>Email:</strong>
                <a href="mailto:${escapeHtml(submission.email)}" class="text-blue-600 hover:text-blue-700">
                    ${escapeHtml(submission.email)}
                </a>
            </div>
            ${submission.subject ? `
            <div>
                <strong>Teema:</strong> ${escapeHtml(submission.subject)}
            </div>
            ` : ''}
            <div>
                <strong>Sõnum:</strong>
                <div class="mt-2 p-4 bg-gray-50 rounded-lg">
                    ${escapeHtml(submission.message).replace(/\n/g, '<br>')}
                </div>
            </div>
            <div class="text-sm text-gray-600">
                <strong>Saadetud:</strong> ${new Date(submission.submitted_at).toLocaleString('et-EE')}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('messageModal').classList.add('hidden');
}

async function exportData() {
    const type = currentFilter === 'all' ? 'membership' : currentFilter;

    try {
        const response = await fetch(`/api/v1/admin/export/${type}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        // Get the filename from headers or use default
        const disposition = response.headers.get('content-disposition');
        const filename = disposition
            ? disposition.split('filename=')[1].replace(/"/g, '')
            : `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;

        // Download the CSV
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Eksportimine ebaõnnestus');
    }
}

async function testEmail() {
    try {
        const response = await fetch('/api/v1/admin/test-email', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert('Test email saadetud!');
        } else {
            alert('Test email saatmine ebaõnnestus: ' + (data.message || 'Tundmatu viga'));
        }
    } catch (error) {
        console.error('Error sending test email:', error);
        alert('Test email saatmine ebaõnnestus');
    }
}

async function runMaintenance() {
    if (!confirm('Kas soovid käivitada hoolduse?')) {
        return;
    }

    try {
        const response = await fetch('/api/v1/admin/maintenance', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Hooldus lõpetatud!\nKustutatud sessioone: ${data.cleaned.sessions}\nKustutatud rate limits: ${data.cleaned.rateLimits}`);
        } else {
            alert('Hooldus ebaõnnestus');
        }
    } catch (error) {
        console.error('Error running maintenance:', error);
        alert('Hooldus ebaõnnestus');
    }
}

function logout() {
    // Clear tokens
    localStorage.removeItem('adminToken');
    document.cookie = 'adminToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';

    // Redirect to login
    window.location.href = '/admin/login';
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Auto-refresh statistics every minute
setInterval(loadStatistics, 60000);