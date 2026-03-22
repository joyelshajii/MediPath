'use strict';
const FeedbackPage = {
    async renderSubmit(container) {
        const docs = await API.getDoctors();
        container.innerHTML = `<div class="page-header"><h2>Leave Feedback</h2></div>
        <div class="feedback-form-wrap">
            <div class="info-card info-card-lg">
                <h3>Share Your Experience</h3>
                <div class="form-group"><label>Patient ID / OP Number (Required)</label>
                    <input type="text" id="fb-patient-id" class="input-field" placeholder="e.g. SJM-2024-001" /></div>
                <div class="form-group"><label>Select Doctor</label>
                    <select id="fb-doctor" class="input-field">
                        <option value="">— Choose a doctor —</option>
                        ${docs.map(d => `<option value="${d.doctor_id}">${d.full_name} — ${d.specialization} (${d.dept_name})</option>`).join('')}
                    </select></div>
                <div class="form-group"><label>Rating</label>
                    <div class="star-rating" id="star-rating">
                        ${[1, 2, 3, 4, 5].map(i => `<span class="star ${i <= 3 ? 'active' : ''}" data-val="${i}" onclick="FeedbackPage.setRating(${i})">★</span>`).join('')}
                    </div></div>
                <div class="form-group"><label>Your Review</label>
                    <textarea id="fb-text" class="input-field" rows="5" placeholder="Tell us about your experience..."></textarea></div>
                <button class="btn btn-primary btn-full" onclick="FeedbackPage.submit()">Submit Feedback</button>
            </div>
            <div id="fb-result" class="feedback-result hidden"></div>
        </div>`;
        this._rating = 3;
    },
    _rating: 3,
    setRating(val) {
        this._rating = val;
        document.querySelectorAll('.star').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.val) <= val);
        });
    },
    async submit() {
        const patient_id = document.getElementById('fb-patient-id').value.trim();
        const doctor_id = parseInt(document.getElementById('fb-doctor').value);
        const raw_text = document.getElementById('fb-text').value.trim();
        if (!patient_id || !doctor_id || !raw_text) { 
            UI.toast('Please provide your Patient ID, select a doctor, and write a review', 'warning'); 
            return; 
        }
        try {
            const res = await API.submitFeedback({ doctor_id, raw_text, rating: this._rating, patient_id });
            const el = document.getElementById('fb-result');
            el.classList.remove('hidden');
            el.innerHTML = `<div class="info-card">
                <h3>Feedback Submitted</h3>
                <div class="report-score-section">
                    <div class="score-circle ${res.sentimentScore>=70?'score-good':res.sentimentScore>=40?'score-mid':'score-low'}">
                        <span class="score-num">${res.sentimentScore}</span><span class="score-label">/ 100</span></div>
                    <div class="report-stats"><div><strong>Sentiment Score</strong></div><div class="text-secondary">${res.summary}</div></div>
                </div>
                ${res.positiveTraits.length?`<div class="trait-tags mt-md">${res.positiveTraits.map(t=>`<span class="tag tag-positive">${t}</span>`).join('')}</div>`:''}
                ${res.negativeTraits.length?`<div class="trait-tags mt-sm">${res.negativeTraits.map(t=>`<span class="tag tag-negative">${t}</span>`).join('')}</div>`:''}
            </div>`;
            document.getElementById('fb-text').value = '';
            UI.toast('Feedback submitted!', 'success');
        } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
    },
    async renderMyFeedback(container) {
        if (!currentUser || !['doctor', 'hod', 'coordinator'].includes(currentUser.role)) {
            container.innerHTML = `<div class="empty-state"><h4>Access Denied</h4></div>`;
            return;
        }
        try {
            UI.showLoader(container);
            // If they are a doctor, show their own. If HoD/Coord, they might reach here from elsewhere.
            // Let's assume this is for 'My Feedback' for doctors.
            const profile = await API.getMyDoctorProfile();
            const report = await API.getDoctorReport(profile.doctor_id);
            const feedback = await API.getDoctorFeedback(profile.doctor_id);
            
            container.innerHTML = `
            <div class="page-header"><h2>My Patient Feedback</h2></div>
            <div class="card-grid">
                <div class="info-card">
                    <h3>Quality Score</h3>
                    <div class="score-circle lg ${report.averageScore >= 70 ? 'score-good' : report.averageScore >= 40 ? 'score-mid' : 'score-low'}">
                        <span class="score-num">${report.averageScore || 0}</span><span class="score-label">/ 100</span>
                    </div>
                    <p class="card-meta">${report.totalReviews} total reviews</p>
                </div>
                <div class="info-card">
                    <h3>Semantic Summary</h3>
                    <p class="report-summary-text">${report.summary}</p>
                    <div class="trait-tags mt-md">
                        ${report.topPositive.map(t => `<span class="tag tag-positive">${t.trait}</span>`).join('')}
                        ${report.topNegative.map(t => `<span class="tag tag-negative">${t.trait}</span>`).join('')}
                    </div>
                </div>
            </div>
            <h3 class="section-title mt-lg">Review History (Anonymized)</h3>
            <div class="feedback-list">
                ${feedback.length === 0 ? '<div class="empty-state">No reviews yet.</div>' : feedback.map(f => `
                    <div class="feedback-item">
                        <div class="feedback-header">
                            <strong>${f.patient_name || 'Verified Patient'}</strong>
                            <div class="feedback-meta">
                                <span class="feedback-score ${f.sentiment_score >= 70 ? 'score-good' : f.sentiment_score >= 40 ? 'score-mid' : 'score-low'}">${f.sentiment_score}/100</span>
                                <span class="feedback-stars">${'★'.repeat(f.rating || 3)}${'☆'.repeat(5 - (f.rating || 3))}</span>
                            </div>
                        </div>
                        <p class="feedback-text">${f.raw_text}</p>
                        <span class="feedback-date">${new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                `).join('')}
            </div>
`;
        } catch (e) { container.innerHTML = `<div class="empty-state"><h4>Error</h4><p>${e.message}</p></div>`; }
    },
    async renderReports(container) {
        if (!currentUser || !['admin', 'hod', 'coordinator', 'receptionist'].includes(currentUser.role)) {
            container.innerHTML = `<div class="empty-state"><h4>Access Denied</h4></div>`;
            return;
        }
        try {
            UI.showLoader(container);
            const summaries = await API.getFeedbackSummary();
            // Filter by department if HoD/Coordinator
            const filtered = (currentUser.role === 'admin' || currentUser.role === 'receptionist') 
                ? summaries 
                : summaries.filter(s => s.dept_id === currentUser.dept_id);

            container.innerHTML = `
            <div class="page-header">
                <h2>Health Quality Metrics</h2>
                <span class="badge">${filtered.length} doctors tracked</span>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>Doctor</th><th>Dept</th><th>Reviews</th><th>Avg Score</th><th>Avg Rating</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${filtered.map(s => `
                            <tr>
                                <td><strong>${s.full_name}</strong><br><small class="text-secondary">${s.specialization}</small></td>
                                <td>${s.dept_name}</td>
                                <td>${s.total_reviews}</td>
                                <td><span class="feedback-score ${(s.average_score || 0) >= 70 ? 'score-good' : (s.average_score || 0) >= 40 ? 'score-mid' : 'score-low'}">${s.average_score || '—'}</span></td>
                                <td>${s.average_rating ? '★'.repeat(Math.round(s.average_rating)) + '☆'.repeat(5 - Math.round(s.average_rating)) : '—'}</td>
                                <td><button class="btn btn-sm btn-outline" onclick="DoctorsPage.viewReport(${s.doctor_id})">Full Report</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
        } catch (e) { container.innerHTML = `<div class="empty-state"><h4>Error</h4><p>${e.message}</p></div>`; }
    }
};
