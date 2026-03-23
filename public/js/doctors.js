'use strict';
const DoctorsPage = {
    async render(container) {
        let doctors;
        try {
            doctors = await API.getDoctors();
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><h4>Unable to load doctors</h4><p>${e.message}</p></div>`;
            return;
        }
        const depts = [...new Set(doctors.map(d => d.dept_name))].sort();
        container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Doctor Presence Board</h2>
                <p class="text-secondary">Real-time availability and location for all staff</p>
            </div>
            <div class="header-meta">
                <span class="ws-status" id="ws-status">● Connecting...</span>
                <select id="dept-filter" class="input-field input-sm" onchange="DoctorsPage.filterDept(this.value)">
                    <option value="">All Departments</option>
                    ${depts.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="doctor-grid" id="doctor-grid">
            ${doctors.map(d => this._card(d)).join('')}
        </div>`;
    },
    _card(d) {
        const sl = { available: 'Available', busy: 'Busy', in_surgery: 'In Surgery', off_duty: 'Off Duty', on_break: 'On Break' };
        const l = sl[d.status] || d.status;

        const canViewReport = currentUser && ['admin', 'hod', 'coordinator', 'receptionist', 'doctor'].includes(currentUser.role);

        return `<div class="doctor-card" data-doctor-id="${d.doctor_id}" data-dept="${d.dept_name}">
            <div class="doctor-card-header">
                <div class="doctor-avatar">${UI.initials(d.full_name)}</div>
                <div class="doctor-status-wrap">
                    <span class="status-dot ${d.status}"></span>
                    <span class="status-label">${l}</span>
                </div>
            </div>
            <div class="doctor-card-body">
                <h4 class="doctor-name">${d.full_name}</h4>
                <p class="doctor-spec">${d.specialization}</p>
                <p class="doctor-dept">${d.dept_name}</p>
                <div class="doctor-detail-row">
                    <span> ${d.current_room || 'Unknown'}</span>
                    <span>${d.current_floor ? d.current_floor + ' Floor' : ''}</span>
                </div>
            </div>
            <div class="doctor-card-actions">
                <button class="btn btn-sm btn-outline btn-full" onclick="DoctorsPage.navTo(${d.current_node_id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Navigate
                </button>
                ${canViewReport ? `
                <button class="btn btn-sm btn-outline btn-full" onclick="DoctorsPage.viewReport(${d.doctor_id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                    Report
                </button>` : ''}
            </div>
        </div>`;
    },
    _updateCard(data) {
        const card = document.querySelector(`[data-doctor-id="${data.doctor_id}"]`);
        if (!card) return;
        const sl = { available: 'Available', busy: 'Busy', in_surgery: 'In Surgery', off_duty: 'Off Duty', on_break: 'On Break' };
        const dot = card.querySelector('.status-dot'), lb = card.querySelector('.status-label');

        if (dot) {
            dot.className = `status-dot ${data.status}`;
            dot.style.background = ''; // Clear inline style
        }
        if (lb) {
            lb.textContent = sl[data.status] || data.status;
            lb.style.color = ''; // Clear inline style
        }

        // Update location if present in WS message
        const loc = card.querySelector('.doctor-detail-row span:first-child');
        if (loc && data.current_room) loc.textContent = ` ${data.current_room}`;

        card.classList.add('status-updated'); setTimeout(() => card.classList.remove('status-updated'), 1500);
        UI.toast(`${data.full_name} is now ${sl[data.status] || data.status}`, 'info');
    },
    filterDept(dept) { document.querySelectorAll('.doctor-card').forEach(c => { c.style.display = (!dept || c.dataset.dept === dept) ? '' : 'none'; }); },
    navTo(nodeId) {
        if (!nodeId) { UI.toast('Doctor location unknown', 'warning'); return; }
        navigateTo('navigate');
        setTimeout(() => { const s = document.getElementById('nav-dest'); if (s) s.value = nodeId; }, 500);
    },
    async viewReport(doctorId) {
        try {
            const r = await API.getDoctorReport(doctorId);
            const d = r.doctor;
            UI.showModalContent(`Quality Report — ${d.full_name}`, `
                <div class="report-modal">
                    <div class="report-score-section">
                        <div class="score-circle ${r.averageScore >= 70 ? 'score-good' : r.averageScore >= 40 ? 'score-mid' : 'score-low'}">
                            <span class="score-num">${r.averageScore || 0}</span><span class="score-label">/ 100</span>
                        </div>
                        <div class="report-stats">
                            <div><strong>${r.totalReviews}</strong> patient reviews</div>
                            <div class="text-secondary">${d.specialization}</div>
                            <div class="text-secondary">${d.dept_name}</div>
                        </div>
                    </div>
                    <div class="report-summary">${r.summary}</div>
                    ${r.topPositive.length ? `<h4> Strengths</h4><div class="trait-tags">${r.topPositive.map(t => `<span class="tag tag-positive">${t.trait} (${t.count})</span>`).join('')}</div>` : ''}
                    ${r.topNegative.length ? `<h4> Improvements</h4><div class="trait-tags">${r.topNegative.map(t => `<span class="tag tag-negative">${t.trait} (${t.count})</span>`).join('')}</div>` : ''}
                    ${r.keywordCloud.length ? `<h4> Sentiment Cloud</h4><div class="keyword-cloud">${r.keywordCloud.slice(0, 15).map(k => `<span class="kw" style="font-size:${Math.min(10 + k.count * 3, 24)}px">${k.word}</span>`).join(' ')}</div>` : ''}
                </div>`);
        } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
    },
    async renderMyStatus(container) {
        if (!currentUser || currentUser.role !== 'doctor') {
            container.innerHTML = `<div class="empty-state"><h4>Access Denied</h4><p>Only doctors can access this page.</p></div>`;
            return;
        }
        try {
            UI.showLoader(container);
            const p = await API.getMyDoctorProfile();
            const rooms = await API.getRooms();
            const opts = ['available', 'busy', 'in_surgery', 'off_duty', 'on_break'];
            container.innerHTML = `
            <div class="page-header"><h2>My Clinic Presence</h2></div>
            <div class="card-grid">
                <div class="info-card info-card-lg">
                    <h3>Current Status</h3>
                    <div class="status-hero">
                        <div class="current-status-display">
                            <span class="status-dot ${p.status}"></span>
                            <span class="status-text">${p.status.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <p class="text-secondary">Logged in as ${p.full_name}</p>
                    </div>
                    <div class="stack-sm mt-md">
                        <div class="detail-item"><strong>Location:</strong> ${p.current_room || 'Not set'}</div>
                        <div class="detail-item"><strong>Floor:</strong> ${p.current_floor || 'N/A'}</div>
                        <div class="detail-item"><strong>Department:</strong> ${p.dept_name}</div>
                    </div>
                </div>
                <div class="info-card info-card-lg">
                    <h3>Update Availability</h3>
                    <form id="status-form" class="stack-md mt-sm" onsubmit="event.preventDefault(); DoctorsPage.updateMyStatus(${p.doctor_id})">
                        <div class="form-group">
                            <label>Availability</label>
                            <select id="doc-status" class="input-field">
                                ${opts.map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s.replace('_', ' ').toUpperCase()}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Your Current Location</label>
                            <select id="doc-room" class="input-field">
                                <option value="">— Select Room —</option>
                                ${rooms.map(r => `<option value="${r.node_id}" ${r.node_id === p.current_node_id ? 'selected' : ''}>${r.label} (${r.floor} Floor)</option>`).join('')}
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary btn-full">Update My Presence</button>
                    </form>
                </div>
            </div>`;
        } catch (e) { container.innerHTML = `<div class="empty-state"><h4>Error</h4><p>${e.message}</p></div>`; }
    },
    async updateMyStatus(id) {
        const s = document.getElementById('doc-status').value;
        const r = document.getElementById('doc-room').value;
        try {
            await API.updateDoctorStatus(id, { status: s, current_node_id: r ? parseInt(r) : null });
            UI.toast('Presence updated successfully', 'success');
            navigateTo('myStatus');
        } catch (e) { UI.toast(e.message, 'error'); }
    },
    async renderManage(container) {
        if (!currentUser || !['admin', 'hod', 'coordinator'].includes(currentUser.role)) {
            container.innerHTML = `<div class="empty-state"><h4>Access Denied</h4></div>`;
            return;
        }
        UI.showLoader(container);
        const docs = await API.getDoctors();
        // Filter by dept if HoD/Coordinator
        const filteredDocs = (currentUser.role === 'admin') ? docs : docs.filter(d => d.dept_id === currentUser.dept_id);

        container.innerHTML = `
        <div class="page-header">
            <h2>Manage Staff Presence</h2>
            <span class="badge">${filteredDocs.length} doctors</span>
        </div>
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>Doctor</th><th>Specialization</th><th>Dept</th><th>Status</th><th>Room</th><th>Actions</th></tr></thead>
                <tbody>
                    ${filteredDocs.map(d => `
                        <tr>
                            <td><strong>${d.full_name}</strong><br><small class="text-secondary">${d.designation}</small></td>
                            <td>${d.specialization}</td>
                            <td>${d.dept_name}</td>
                            <td><span class="status-dot ${d.status}"></span> ${d.status.replace('_', ' ')}</td>
                            <td>${d.current_room || '—'}</td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="DoctorsPage.viewReport(${d.doctor_id})">Report</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }
};
