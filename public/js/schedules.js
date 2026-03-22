'use strict';

const SchedulesPage = {
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Schedule Management</h2>
                    <p class="text-secondary">View and manage appointments, surgeries, and duty shifts</p>
                </div>
                ${currentUser && ['admin', 'hod', 'coordinator', 'doctor'].includes(currentUser.role) ? `
                    <button class="btn btn-primary" onclick="SchedulesPage.showAddModal()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Add Schedule</span>
                    </button>
                ` : ''}
            </div>

            <div class="card-grid" id="schedules-list">
                <div class="loading-inline">Loading schedules...</div>
            </div>

            <!-- Add Schedule Modal -->
            <div id="schedule-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add Schedule Item</h3>
                        <button class="close-btn" onclick="UI.closeModal('schedule-modal')">&times;</button>
                    </div>
                    <form id="schedule-form" class="modal-body stack-md">
                        <div class="form-group">
                            <label>Title / Description</label>
                            <input type="text" id="sched-title" placeholder="e.g. Morning OPD, Surgery - Ortho" required>
                        </div>
                        <div class="row">
                            <div class="form-group col-6">
                                <label>Type</label>
                                <select id="sched-type">
                                    <option value="appointment">Appointment</option>
                                    <option value="opd">OPD</option>
                                    <option value="surgery">Surgery</option>
                                    <option value="leave">Leave</option>
                                    <option value="duty">Duty</option>
                                </select>
                            </div>
                            <div class="form-group col-6" id="user-selection-group" style="display:none">
                                <label>Assign To (Staff)</label>
                                <select id="sched-user-id"></select>
                            </div>
                        </div>
                        <div class="row">
                            <div class="form-group col-6">
                                <label>Start Date & Time</label>
                                <input type="datetime-local" id="sched-start" required>
                            </div>
                            <div class="form-group col-6">
                                <label>End Date & Time</label>
                                <input type="datetime-local" id="sched-end" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="sched-notes" rows="3" placeholder="Additional details..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="UI.closeModal('schedule-modal')">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save Schedule</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        await this.loadSchedules();
        this.setupForm();
    },

    async loadSchedules() {
        const list = document.getElementById('schedules-list');
        try {
            let data;
            if (['admin', 'hod', 'coordinator'].includes(currentUser.role)) {
                // If HoD/Coord, load dept schedules. If Admin, could load all or filter.
                // For now, let's load dept schedules if dept_id exists, else own.
                if (currentUser.dept_id) {
                    data = await API.getDeptSchedules(currentUser.dept_id);
                } else {
                    data = await API.getMySchedules();
                }
            } else {
                data = await API.getMySchedules();
            }

            if (!data || data.length === 0) {
                list.innerHTML = `<div class="empty-state">No scheduled items found.</div>`;
                return;
            }

            list.innerHTML = data.map(s => `
                <div class="info-card schedule-card ${s.schedule_type}">
                    <div class="card-title">
                        ${s.title}
                        <span class="badge badge-sm">${s.schedule_type.toUpperCase()}</span>
                    </div>
                    <div class="card-meta">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>${this.formatDateTime(s.start_time)} - ${this.formatDateTime(s.end_time)}</span>
                    </div>
                    ${s.full_name ? `<div class="card-meta"><strong>Staff:</strong> ${s.full_name} (${s.role})</div>` : ''}
                    ${s.notes ? `<p class="card-notes mt-sm">${s.notes}</p>` : ''}
                    ${this.canManage(s) ? `
                        <div class="card-actions mt-md">
                            <button class="btn btn-sm btn-outline-danger" onclick="SchedulesPage.deleteSchedule(${s.schedule_id})">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } catch (err) {
            list.innerHTML = `<div class="empty-state text-danger">Error: ${err.message}</div>`;
        }
    },

    canManage(item) {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        if (item.user_id === currentUser.user_id) return true;
        if (['hod', 'coordinator'].includes(currentUser.role)) {
            // Backend enforces dept, but we can assume if they see it they might be able to delete
            return true;
        }
        return false;
    },

    getTypeColor(type) {
        switch (type) {
            case 'surgery': return 'danger';
            case 'opd': return 'primary';
            case 'leave': return 'warning';
            case 'duty': return 'info';
            default: return 'secondary';
        }
    },

    formatDateTime(iso) {
        const d = new Date(iso);
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    async showAddModal() {
        const modal = document.getElementById('schedule-modal');
        const userGroup = document.getElementById('user-selection-group');
        const userSelect = document.getElementById('sched-user-id');

        if (['admin', 'hod', 'coordinator'].includes(currentUser.role)) {
            userGroup.style.display = 'block';
            const users = await API.getUsers({ dept_id: currentUser.dept_id });
            // Filter only doctors and nurses
            const staff = users.filter(u => ['doctor', 'nurse'].includes(u.role));
            userSelect.innerHTML = staff.map(u => `<option value="${u.user_id}">${u.full_name} (${u.role})</option>`).join('');
        } else {
            userGroup.style.display = 'none';
        }

        UI.showModal('schedule-modal');
    },

    setupForm() {
        const form = document.getElementById('schedule-form');
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const body = {
                title: document.getElementById('sched-title').value,
                schedule_type: document.getElementById('sched-type').value,
                start_time: document.getElementById('sched-start').value,
                end_time: document.getElementById('sched-end').value,
                notes: document.getElementById('sched-notes').value,
            };
            if (['admin', 'hod', 'coordinator'].includes(currentUser.role)) {
                body.user_id = document.getElementById('sched-user-id').value;
            }

            try {
                await API.createSchedule(body);
                UI.closeModal('schedule-modal');
                UI.toast('Schedule added successfully', 'success');
                this.loadSchedules();
            } catch (err) {
                UI.toast(err.message, 'error');
            }
        };
    },

    async deleteSchedule(id) {
        if (!confirm('Are you sure you want to delete this schedule item?')) return;
        try {
            await API.deleteSchedule(id);
            UI.toast('Schedule deleted', 'success');
            this.loadSchedules();
        } catch (err) {
            UI.toast(err.message, 'error');
        }
    },

    async renderAllocations(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h2>Nurse Duty Allocations</h2>
                    <p class="text-secondary">Assignments for nurses under specific doctors</p>
                </div>
                ${currentUser && ['admin', 'hod', 'coordinator'].includes(currentUser.role) ? `
                    <button class="btn btn-primary" onclick="SchedulesPage.showAllocModal()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Assign Nurse</span>
                    </button>
                ` : ''}
            </div>

            <div class="table-wrap" id="alloc-list">
                <div class="loading-inline">Loading allocations...</div>
            </div>

            <!-- Allocation Modal -->
            <div id="alloc-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>New Nurse Allocation</h3>
                        <button class="close-btn" onclick="UI.closeModal('alloc-modal')">&times;</button>
                    </div>
                    <form id="alloc-form" class="modal-body stack-md">
                        <div class="form-group">
                            <label>Nurse</label>
                            <select id="alloc-nurse-id" required></select>
                        </div>
                        <div class="form-group">
                            <label>Assigned Doctor</label>
                            <select id="alloc-doctor-id" required></select>
                        </div>
                        <div class="row">
                            <div class="form-group col-6">
                                <label>Date</label>
                                <input type="date" id="alloc-date" required>
                            </div>
                            <div class="form-group col-6">
                                <label>Shift</label>
                                <select id="alloc-shift">
                                    <option value="day">Day Shift</option>
                                    <option value="night">Night Shift</option>
                                    <option value="evening">Evening Shift</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea id="alloc-notes" rows="2" placeholder="Specific instructions..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="UI.closeModal('alloc-modal')">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Allocation</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        await this.loadAllocations();
        this.setupAllocForm();
    },

    async loadAllocations() {
        const list = document.getElementById('alloc-list');
        try {
            const data = await API.getNurseAllocations();
            if (!data || data.length === 0) {
                list.innerHTML = `<div class="empty-state">No duty allocations found.</div>`;
                return;
            }

            list.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            ${currentUser.role !== 'nurse' ? '<th>Nurse</th>' : ''}
                            <th>Doctor</th>
                            <th>Date</th>
                            <th>Shift</th>
                            <th>Notes</th>
                            ${['admin', 'hod', 'coordinator'].includes(currentUser.role) ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(a => `
                            <tr>
                                ${currentUser.role !== 'nurse' ? `<td><strong>${a.nurse_name || '—'}</strong></td>` : ''}
                                <td>${a.doctor_name} <small class="text-secondary">(${a.specialization})</small></td>
                                <td>${a.duty_date}</td>
                                <td><span class="badge badge-sm badge-info">${a.shift.toUpperCase()}</span></td>
                                <td>${a.notes || '—'}</td>
                                ${['admin', 'hod', 'coordinator'].includes(currentUser.role) ? `
                                    <td>
                                        <button class="btn btn-sm btn-outline-danger" onclick="SchedulesPage.deleteAlloc(${a.allocation_id})">Delete</button>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (err) {
            list.innerHTML = `<div class="empty-state text-danger">Error: ${err.message}</div>`;
        }
    },

    async showAllocModal() {
        const nurseSelect = document.getElementById('alloc-nurse-id');
        const docSelect = document.getElementById('alloc-doctor-id');

        const users = await API.getUsers({ dept_id: currentUser.dept_id });
        const nurses = users.filter(u => u.role === 'nurse');
        nurseSelect.innerHTML = nurses.map(u => `<option value="${u.user_id}">${u.full_name}</option>`).join('');

        const doctors = await API.getDoctors();
        // Filter doctors by dept if not admin
        const deptDoctors = currentUser.role === 'admin' ? doctors : doctors.filter(d => d.dept_id === currentUser.dept_id);
        docSelect.innerHTML = deptDoctors.map(d => `<option value="${d.doctor_id}">${d.full_name} (${d.specialization})</option>`).join('');

        UI.showModal('alloc-modal');
    },

    setupAllocForm() {
        const form = document.getElementById('alloc-form');
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const body = {
                nurse_user_id: document.getElementById('alloc-nurse-id').value,
                doctor_id: document.getElementById('alloc-doctor-id').value,
                duty_date: document.getElementById('alloc-date').value,
                shift: document.getElementById('alloc-shift').value,
                notes: document.getElementById('alloc-notes').value,
            };

            try {
                await API.createNurseAllocation(body);
                UI.closeModal('alloc-modal');
                UI.toast('Allocation created', 'success');
                this.loadAllocations();
            } catch (err) {
                UI.toast(err.message, 'error');
            }
        };
    },

    async deleteAlloc(id) {
        if (!confirm('Are you sure you want to delete this allocation?')) return;
        try {
            await API.deleteNurseAllocation(id);
            UI.toast('Allocation deleted', 'success');
            this.loadAllocations();
        } catch (err) {
            UI.toast(err.message, 'error');
        }
    }
};

window.SchedulesPage = SchedulesPage;
