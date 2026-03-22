'use strict';

// ─── API Utility ──────────────────────────────────────────
const API = {
    _token: null,

    setToken(t) { this._token = t; },
    clearToken() { this._token = null; },

    async request(method, path, body = null) {
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
            },
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`/api${path}`, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    },

    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    put(path, body) { return this.request('PUT', path, body); },
    patch(path, body) { return this.request('PATCH', path, body); },
    del(path) { return this.request('DELETE', path); },

    // Auth
    login(u, p) { return this.post('/auth/login', { username: u, password: p }); },

    // Navigation
    getNodes() { return this.get('/navigation/nodes'); },
    getEdges() { return this.get('/navigation/edges'); },
    getRooms() { return this.get('/navigation/rooms'); },
    getRoute(from, to) { return this.get(`/navigation/route?from=${from}&to=${to}`); },
    resolveQR(code) { return this.get(`/navigation/qr/${encodeURIComponent(code)}`); },

    // Doctors
    getDoctors() { return this.get('/doctors'); },
    getDoctor(id) { return this.get(`/doctors/${id}`); },
    getDoctorsByDept(deptId) { return this.get(`/doctors/department/${deptId}`); },
    updateDoctorStatus(id, body) { return this.put(`/doctors/${id}/status`, body); },
    getMyDoctorProfile() { return this.get('/doctors/me/profile'); },

    // Feedback
    submitFeedback(body) { return this.post('/feedback', body); },
    getDoctorFeedback(doctorId) { return this.get(`/feedback/doctor/${doctorId}`); },
    getDoctorReport(doctorId) { return this.get(`/feedback/doctor/${doctorId}/report`); },
    getFeedbackSummary() { return this.get('/feedback/summary'); },

    // Users
    getUsers(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get(`/users${q ? '?' + q : ''}`);
    },
    getUser(id) { return this.get(`/users/${id}`); },
    createUser(body) { return this.post('/users', body); },
    updateUser(id, body) { return this.put(`/users/${id}`, body); },
    deleteUser(id) { return this.del(`/users/${id}`); },
    toggleAccess(id, flag) { return this.patch(`/users/${id}/access`, { is_active: flag }); },

    // Departments
    getDepartments() { return this.get('/departments'); },
    createDept(body) { return this.post('/departments', body); },
    updateDept(id, body) { return this.put(`/departments/${id}`, body); },
    deleteDept(id) { return this.del(`/departments/${id}`); },

    // Locations (kept for compatibility)
    getLocations(deptId) { return this.get(`/locations${deptId ? '?dept_id=' + deptId : ''}`); },

    // Schedules
    getMySchedules() { return this.get('/schedules/my'); },
    getUserSchedules(userId) { return this.get(`/schedules/user/${userId}`); },
    getDeptSchedules(deptId) { return this.get(`/schedules/department/${deptId}`); },
    createSchedule(body) { return this.post('/schedules', body); },
    updateSchedule(id, body) { return this.put(`/schedules/${id}`, body); },
    deleteSchedule(id) { return this.del(`/schedules/${id}`); },
    getNurseAllocations() { return this.get('/schedules/nurse/allocations'); },
    createNurseAllocation(body) { return this.post('/schedules/nurse/allocations', body); },
    deleteNurseAllocation(id) { return this.del(`/schedules/nurse/allocations/${id}`); },

    // Utility
    getRoles() { return this.get('/utils/roles'); },
};
