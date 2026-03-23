'use strict';

// ─── App State ────────────────────────────────────────────
let currentUser = null;
let currentPage = null;

// ─── Menu Definitions per Role ────────────────────────────
const MENUS = {
    guest: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'doctorBoard', label: 'Find a Doctor', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>` },
        { id: 'leaveFeedback', label: 'Leave Feedback', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>` },
    ],
    patient: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'doctorBoard', label: 'Find a Doctor', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>` },
        { id: 'leaveFeedback', label: 'Leave Feedback', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>` },
    ],
    doctor: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'myStatus', label: 'My Status', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>` },
        { id: 'schedules', label: 'My Schedule', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
        { id: 'myFeedback', label: 'Anonymized Feedback', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>` },
        { id: 'doctorBoard', label: 'Doctor Board', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>` },
    ],
    nurse: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'schedules', label: 'My Duty Schedule', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
        { id: 'nurseAllocations', label: 'Doctor Assignments', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>` },
        { id: 'doctorBoard', label: 'Doctor Board', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>` },
    ],
    hod: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'manageUsers', label: 'Department Users', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
        { id: 'manageNodes', label: 'Dept Locations', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` },
        { id: 'schedules', label: 'Staff schedules', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
        { id: 'nurseAllocations', label: 'Nurse Duty Setup', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>` },
        { id: 'feedbackReports', label: 'Dept Feedback', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
    ],
    coordinator: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'manageUsers', label: 'Manage Staff', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
        { id: 'manageNodes', label: 'Manage Rooms', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` },
        { id: 'schedules', label: 'Staff schedules', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
        { id: 'nurseAllocations', label: 'Nurse Allocation', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>` },
    ],
    receptionist: [
        { id: 'navigate', label: 'Navigate Patient', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'manageUsers', label: 'Patient Management', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
        { id: 'doctorBoard', label: 'Doctor Board', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>` },
        { id: 'feedbackReports', label: 'Feedback Reports', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
    ],
    admin: [
        { id: 'navigate', label: 'Navigate Hospital', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>` },
        { id: 'doctorBoard', label: 'Doctor Board', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>` },
        { id: 'schedules', label: 'Hospital Schedules', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
        { id: 'manageDoctors', label: 'Manage Doctors', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>` },
        { id: 'manageDepartments', label: 'Manage Departments', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
        { id: 'manageNodes', label: 'Manage Locations', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>` },
        { id: 'manageUsers', label: 'Manage Users', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
        { id: 'feedbackReports', label: 'Feedback Reports', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
    ],
};

// ─── Page Titles ──────────────────────────────────────────
const PAGE_TITLES = {
    navigate: 'Navigate Hospital',
    doctorBoard: 'Doctor Board',
    leaveFeedback: 'Leave Feedback',
    myStatus: 'My Status & Availability',
    myFeedback: 'My Patient Feedback',
    feedbackReports: 'Feedback Reports',
    manageDoctors: 'Manage Doctors',
    manageDepartments: 'Manage Departments',
    manageUsers: 'Manage Users',
    schedules: 'Schedule Management',
    nurseAllocations: 'Nurse Duty Allocations',
};

// ─── Login ────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in...';
    try {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const data = await API.login(username, password);
        API.setToken(data.token);
        sessionStorage.setItem('mp_token', data.token);
        sessionStorage.setItem('mp_user', JSON.stringify(data.user));
        initApp(data.user);
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Sign In';
    }
});

function quickLogin(u, p) {
    document.getElementById('login-username').value = u;
    document.getElementById('login-password').value = p;
    document.getElementById('login-form').requestSubmit();
}

function browseAsGuest() {
    initApp(null);
}

// ─── App init ─────────────────────────────────────────────
function initApp(user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    buildSidebar(user);
    startClock();
    if (user) {
        initWS();
        navigateTo('navigate'); // or dashboard if we had one
    } else {
        if (window._doctorWs) { window._doctorWs.close(); window._doctorWs = null; }
        navigateTo('navigate');
    }
}

function initWS() {
    if (window._doctorWs) window._doctorWs.close();
    try {
        const p = location.protocol === 'https:' ? 'wss:' : 'ws:';
        window._doctorWs = new WebSocket(`${p}//${location.host}/ws`);
        window._doctorWs.onopen = () => {
            const e = document.getElementById('ws-status');
            if (e) { e.textContent = '● Live'; e.style.color = '#22c55e'; }
        };
        window._doctorWs.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.type === 'doctor_status') {
                if (window.DoctorsPage && typeof DoctorsPage._updateCard === 'function') {
                    DoctorsPage._updateCard(m.data);
                }
            } else if (m.type === 'schedule_updated') {
                if (window.SchedulesPage && currentPage === 'schedules') {
                    SchedulesPage.loadSchedules();
                }
                if (m.user_id === currentUser?.user_id) {
                    UI.toast('Your schedule has been updated', 'info');
                }
            }
        };
        window._doctorWs.onclose = () => {
            const e = document.getElementById('ws-status');
            if (e) { e.textContent = '● Offline'; e.style.color = '#ef4444'; }
            // Reconnect logic would go here, but only if user still logged in
        };
    } catch (e) { console.warn('WS fail:', e); }
}

function doLogout() {
    sessionStorage.clear();
    API.clearToken();
    currentUser = null;
    if (window._doctorWs) {
        window._doctorWs.close();
        window._doctorWs = null;
    }
    initApp(null);
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
}

function hideLogin() {
    document.getElementById('login-screen').classList.add('hidden');
}

// ─── Sidebar Builder ──────────────────────────────────────
function buildSidebar(user) {
    const isGuest = !user;
    const role = isGuest ? 'guest' : user.role;
    const fullName = isGuest ? 'Guest Visitor' : user.full_name;

    document.getElementById('user-avatar-sidebar').textContent = UI.initials(fullName);
    document.getElementById('user-name-sidebar').textContent = fullName;
    document.getElementById('user-role-sidebar').innerHTML = UI.roleBadge(role);
    document.getElementById('topbar-user').textContent = fullName;

    if (!isGuest && user.dept_name) {
        document.getElementById('sidebar-dept').innerHTML = `<strong>${user.dept_code}</strong> — ${user.dept_name}`;
    } else {
        document.getElementById('sidebar-dept').innerHTML = `<strong>St. Joseph's Mission Hospital</strong>`;
    }

    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    const menus = JSON.parse(JSON.stringify(MENUS[role] || []));

    // If guest, add a Sign In option at the end
    if (isGuest) {
        menus.push({ id: 'login', label: 'Authorized Sign In', icon: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>` });
    }

    menus.forEach(item => {
        const section = document.createElement('div');
        section.className = 'nav-section';
        const el = document.createElement('div');
        el.className = 'nav-item';
        el.id = `nav-${item.id}`;
        el.innerHTML = `${item.icon}<span class="nav-label">${item.label}</span>`;
        if (item.id === 'login') {
            el.onclick = () => showLogin();
        } else {
            el.onclick = () => navigateTo(item.id);
        }
        section.appendChild(el);
        nav.appendChild(section);
    });

    // Hide/Show logout button based on guest status
    const logoutBtn = document.querySelector('.btn-logout');
    if (logoutBtn) {
        logoutBtn.style.display = isGuest ? 'none' : 'flex';
    }

    document.getElementById('sidebar-toggle').onclick = () => {
        const sidebar = document.getElementById('sidebar');
        const shell = document.getElementById('app-shell');
        sidebar.classList.toggle('collapsed');
        shell.classList.toggle('sidebar-collapsed');
    };
}

// ─── Navigation ───────────────────────────────────────────
async function navigateTo(pageId) {
    currentPage = pageId;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${pageId}`);
    if (navEl) navEl.classList.add('active');
    document.getElementById('topbar-title').textContent = PAGE_TITLES[pageId] || pageId;
    const content = document.getElementById('page-content');
    UI.showLoader(content);
    closeSidebar();
    try {
        await renderPage(pageId, content);
    } catch (err) {
        content.innerHTML = `<div class="empty-state"><h4>Error loading page</h4><p>${err.message}</p></div>`;
    }
}

async function renderPage(pageId, container) {
    switch (pageId) {
        case 'navigate': await NavigationPage.render(container); break;
        case 'doctorBoard': await DoctorsPage.render(container); break;
        case 'leaveFeedback': await FeedbackPage.renderSubmit(container); break;
        case 'myStatus': await DoctorsPage.renderMyStatus(container); break;
        case 'myFeedback': await FeedbackPage.renderMyFeedback(container); break;
        case 'feedbackReports': await FeedbackPage.renderReports(container); break;
        case 'manageDoctors': await DoctorsPage.renderManage(container); break;
        case 'manageDepartments': await renderManageDepartments(container); break;
        case 'manageUsers': await renderManageUsers(container); break;
        case 'manageNodes': await renderManageNodes(container); break;
        case 'schedules': await SchedulesPage.render(container); break;
        case 'nurseAllocations': await SchedulesPage.renderAllocations(container); break;
        default: container.innerHTML = `<div class="empty-state"><h4>Page not found</h4></div>`;
    }
}

// ─── Simple Admin Pages ───────────────────────────────────
async function renderManageDepartments(container) {
    const depts = await API.getDepartments();
    const canAdd = currentUser && currentUser.role === 'admin';
    
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Manage Departments</h2>
                <p class="text-secondary">Hospital organizational structure</p>
            </div>
            ${canAdd ? `
                <button class="btn btn-primary" onclick="showAddDeptModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span>Add Department</span>
                </button>
            ` : ''}
        </div>
        <div class="card-grid">
            ${depts.map(d => `
                <div class="info-card">
                    <div class="card-title">${d.dept_name}</div>
                    <div class="card-meta">${d.dept_code} • ${d.floor || 'External'} Floor</div>
                    ${canAdd ? `
                        <div class="card-actions mt-md">
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteDept(${d.dept_id})">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

async function showAddDeptModal() {
    const bodyHtml = `
        <form id="add-dept-form" class="stack-md">
            <div class="form-group">
                <label>Department Name</label>
                <input type="text" id="new-dept-name" required placeholder="e.g. Cardiology">
            </div>
            <div class="row">
                <div class="form-group col-6">
                    <label>Code</label>
                    <input type="text" id="new-dept-code" required placeholder="CARD">
                </div>
                <div class="form-group col-6">
                    <label>Floor</label>
                    <input type="text" id="new-dept-floor" placeholder="e.g. Ground, 2nd">
                </div>
            </div>
            <div class="modal-footer" style="padding-top: 20px;">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Department</button>
            </div>
        </form>
    `;

    openModal('Add Department', bodyHtml);

    document.getElementById('add-dept-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            dept_name: document.getElementById('new-dept-name').value,
            dept_code: document.getElementById('new-dept-code').value,
            floor: document.getElementById('new-dept-floor').value || null
        };
        try {
            await API.createDept(body);
            closeModal();
            UI.toast('Department created', 'success');
            renderManageDepartments(document.getElementById('page-content'));
        } catch (err) { UI.toast(err.message, 'error'); }
    };
}

async function deleteDept(id) {
    if (!confirm('Are you sure? This will NOT delete doctors in the department but may cause issues with their display.')) return;
    try {
        await API.deleteDept(id);
        UI.toast('Department deleted', 'success');
        renderManageDepartments(document.getElementById('page-content'));
    } catch (e) { UI.toast(e.message, 'error'); }
}

async function renderManageUsers(container) {
    const isRec = currentUser.role === 'receptionist';
    const params = isRec ? { role_filter: 'patient' } : {};
    const users = await API.getUsers(params);
    const canAdd = currentUser && ['admin', 'hod', 'coordinator', 'receptionist'].includes(currentUser.role);
    
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Manage Users</h2>
                <span class="badge">${users.length} users</span>
            </div>
            ${canAdd ? `
                <button class="btn btn-primary" onclick="showAddUserModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span>Add User</span>
                </button>
            ` : ''}
        </div>
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td><strong>${u.full_name}</strong></td>
                            <td><code>${u.username}</code></td>
                            <td>${UI.roleBadge(u.role)}</td>
                            <td>${u.dept_name || '—'}</td>
                            <td>${u.is_active ? '<span class="status-dot available"></span> Active' : '<span class="status-dot off_duty"></span> Inactive'}</td>
                            <td>
                                <div class="row gap-xs">
                                    ${currentUser.role === 'admin' || (['hod', 'coordinator'].includes(currentUser.role) && u.dept_id === currentUser.dept_id) ? `
                                        <button class="btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}"
                                            onclick="toggleUserAccess(${u.user_id}, ${u.is_active ? 0 : 1})">
                                            ${u.is_active ? 'Disable' : 'Enable'}
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.user_id})">Delete</button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function showAddUserModal() {
    const roles = await API.getRoles();
    const depts = await API.getDepartments();
    
    // Filter roles based on current user role
    let filteredRoles = roles;
    if (currentUser.role === 'receptionist') {
        filteredRoles = roles.filter(r => r.role_name === 'patient');
    } else if (['hod', 'coordinator'].includes(currentUser.role)) {
        filteredRoles = roles.filter(r => ['doctor', 'nurse'].includes(r.role_name));
    }

    const bodyHtml = `
        <form id="add-user-form" class="stack-md">
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="new-user-fullname" required placeholder="e.g. John Doe">
            </div>
            <div class="row">
                <div class="form-group col-6">
                    <label>Username</label>
                    <input type="text" id="new-user-username" required placeholder="j.doe">
                </div>
                <div class="form-group col-6">
                    <label>Password</label>
                    <input type="password" id="new-user-password" required placeholder="••••••••">
                </div>
            </div>
            <div class="row">
                <div class="form-group col-6">
                    <label>Role</label>
                    <select id="new-user-role" required>
                        ${filteredRoles.map(r => `<option value="${r.role_name}">${UI.roleBadge(r.role_name).replace(/<[^>]*>/g, '')}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group col-6">
                    <label>Department</label>
                    <select id="new-user-dept" ${currentUser.role !== 'admin' ? 'disabled' : ''}>
                        <option value="">None</option>
                        ${depts.map(d => `<option value="${d.dept_id}" ${d.dept_id === currentUser.dept_id ? 'selected' : ''}>${d.dept_name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Email (Optional)</label>
                <input type="email" id="new-user-email" placeholder="john@example.com">
            </div>
            <div class="modal-footer" style="padding-top: 20px;">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create User</button>
            </div>
        </form>
    `;

    openModal('Add New User', bodyHtml);

    document.getElementById('add-user-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            full_name: document.getElementById('new-user-fullname').value,
            username: document.getElementById('new-user-username').value,
            password: document.getElementById('new-user-password').value,
            role_name: document.getElementById('new-user-role').value,
            dept_id: document.getElementById('new-user-dept').value || null,
            email: document.getElementById('new-user-email').value || null
        };
        try {
            await API.createUser(body);
            closeModal();
            UI.toast('User created successfully', 'success');
            renderManageUsers(document.getElementById('page-content'));
        } catch (err) { UI.toast(err.message, 'error'); }
    };
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user? This action is irreversible.')) return;
    try {
        await API.deleteUser(id);
        UI.toast('User deleted', 'success');
        renderManageUsers(document.getElementById('page-content'));
    } catch (e) { UI.toast(e.message, 'error'); }
}

async function toggleUserAccess(userId, flag) {
    try {
        await API.toggleAccess(userId, flag);
        UI.toast(flag ? 'User enabled' : 'User disabled', 'success');
        navigateTo('manageUsers');
    } catch (e) { UI.toast(e.message, 'error'); }
}

// ─── Clock ────────────────────────────────────────────────
function startClock() {
    function tick() {
        const now = new Date();
        const istOffset = 5 * 60 + 30;
        const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
        const istMin = (utcMin + istOffset) % (24 * 60);
        const h = Math.floor(istMin / 60), m = istMin % 60;
        const hh = h > 12 ? h - 12 : h || 12;
        const mm = String(m).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const istDate = new Date(now.getTime() + istOffset * 60000);
        const day = days[istDate.getUTCDay()];
        document.getElementById('topbar-time').textContent = `${day}, ${hh}:${mm} ${ampm} IST`;
    }
    tick();
    setInterval(tick, 30000);
}

// ─── Mobile Sidebar ───────────────────────────────────────
function openSidebar() {
    document.getElementById('sidebar').classList.add('mobile-open');
    document.getElementById('sidebar-overlay').classList.add('visible');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('visible');
}

// ─── Session restore ──────────────────────────────────────
(function () {
    const token = sessionStorage.getItem('mp_token');
    const userStr = sessionStorage.getItem('mp_user');
    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            API.setToken(token);
            initApp(user);
            return;
        } catch { sessionStorage.clear(); }
    }
    // Default to guest if no session
    initApp(null);
})();

async function renderManageNodes(container) {
    const nodes = await API.getNodes();
    const depts = await API.getDepartments();
    const userDept = depts.find(d => d.dept_id === currentUser.dept_id);
    const userFloor = userDept?.floor;

    let filteredNodes = nodes;
    if (currentUser.role !== 'admin' && userFloor) {
        filteredNodes = nodes.filter(n => n.floor === userFloor);
    }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Manage Locations</h2>
                <p class="text-secondary">${currentUser.role === 'admin' ? 'All hospital nodes' : 'Locations on ' + userFloor}</p>
            </div>
            <button class="btn btn-primary" onclick="showAddNodeModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Add Room/Node</span>
            </button>
        </div>
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>Label</th><th>Type</th><th>Floor</th><th>Coordinates</th><th>QR Code</th><th>Actions</th></tr></thead>
                <tbody>
                    ${filteredNodes.map(n => `
                        <tr>
                            <td><strong>${n.label || 'Unnamed Node'}</strong></td>
                            <td><span class="badge">${n.node_type}</span></td>
                            <td>${n.floor}</td>
                            <td><kbd>${n.x}, ${n.y}</kbd></td>
                            <td><code>${n.qr_code || '—'}</code></td>
                            <td>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteNode(${n.node_id})">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function showAddNodeModal() {
    const depts = await API.getDepartments();
    const userDept = depts.find(d => d.dept_id === currentUser.dept_id);
    const floors = [...new Set(depts.map(d => d.floor))].filter(Boolean);

    const bodyHtml = `
        <form id="add-node-form" class="stack-md">
            <div class="form-group">
                <label>Label / Room Name</label>
                <input type="text" id="node-label" required placeholder="e.g. Room 101, Radiology Waiting">
            </div>
            <div class="row">
                <div class="form-group col-6">
                    <label>Node Type</label>
                    <select id="node-type" required>
                        <option value="room">Room</option>
                        <option value="hallway">Hallway / Junction</option>
                        <option value="elevator">Elevator</option>
                        <option value="stairs">Stairs</option>
                        <option value="entrance">Entrance</option>
                    </select>
                </div>
                <div class="form-group col-6">
                    <label>Floor</label>
                    <select id="node-floor" required ${currentUser.role !== 'admin' ? 'disabled' : ''}>
                        ${floors.map(f => `<option value="${f}" ${f === userDept?.floor ? 'selected' : ''}>${f}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="row">
                <div class="form-group col-6">
                    <label>X-Coordinate</label>
                    <input type="number" id="node-x" value="100" required>
                </div>
                <div class="form-group col-6">
                    <label>Y-Coordinate</label>
                    <input type="number" id="node-y" value="100" required>
                </div>
            </div>
            <div class="form-group">
                <label>QR Code Identifier (Optional)</label>
                <input type="text" id="node-qr" placeholder="e.g. qr_room_101">
            </div>
            <div class="modal-footer" style="padding-top: 20px;">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Location</button>
            </div>
        </form>
    `;

    openModal('Add Hospital Location', bodyHtml);

    document.getElementById('add-node-form').onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            label: document.getElementById('node-label').value,
            node_type: document.getElementById('node-type').value,
            floor: document.getElementById('node-floor').value,
            x: parseInt(document.getElementById('node-x').value),
            y: parseInt(document.getElementById('node-y').value),
            qr_code: document.getElementById('node-qr').value || null
        };
        try {
            await API.post('/navigation/nodes', body);
            closeModal();
            UI.toast('Location added', 'success');
            renderManageNodes(document.getElementById('page-content'));
        } catch (err) { UI.toast(err.message, 'error'); }
    };
}

async function deleteNode(id) {
    if (!confirm('Are you sure? This may break existing routes.')) return;
    try {
        await API.del(`/navigation/nodes/${id}`);
        UI.toast('Location deleted', 'success');
        renderManageNodes(document.getElementById('page-content'));
    } catch (e) { UI.toast(e.message, 'error'); }
}
