'use strict';

// ─── Navigation Page — SVG Map + Pathfinding ──────────────
const NavigationPage = {
    _nodes: [],
    _edges: [],
    _rooms: [],
    _currentFloor: 'Ground',
    _routeData: null,
    _originNodeId: null,

    async render(container) {
        const [nodes, edges, rooms] = await Promise.all([
            API.getNodes(), API.getEdges(), API.getRooms()
        ]);
        this._nodes = nodes;
        this._edges = edges;
        this._rooms = rooms;

        const floors = [...new Set(nodes.map(n => n.floor))].sort();

        container.innerHTML = `
        <div class="nav-page">
            <div class="nav-controls">
                <div class="nav-panel">
                    <h3> Where are you?</h3>
                    <div class="form-group">
                        <label>Scan QR Code or Select Location</label>
                        <div class="qr-input-wrap">
                            <input type="text" id="nav-qr-input" placeholder="e.g. QR-ENTRANCE-MAIN" class="input-field" />
                            <button class="btn btn-primary btn-sm" onclick="NavigationPage.resolveQR()">Scan</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Or select starting point</label>
                        <select id="nav-origin" class="input-field" onchange="NavigationPage.setOrigin(this.value)">
                            <option value="">— Select origin —</option>
                            ${nodes.filter(n => n.qr_code).map(n =>
            `<option value="${n.node_id}">${n.label} (${n.floor})</option>`
        ).join('')}
                        </select>
                    </div>
                    <div id="nav-origin-info" class="origin-info hidden"></div>
                </div>

                <div class="nav-panel">
                    <h3> Where do you want to go?</h3>
                    <div class="form-group">
                        <label>Select destination</label>
                        <select id="nav-dest" class="input-field">
                            <option value="">— Select destination —</option>
                            ${this._rooms.map(r =>
            `<option value="${r.node_id}">${r.label} (${r.floor})</option>`
        ).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary btn-full" onclick="NavigationPage.findRoute()" id="nav-find-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 11l19-9-9 19-2-8-8-2z"/>
                        </svg>
                        Find Route
                    </button>
                </div>
            </div>

            <div class="map-section">
                <div class="map-toolbar">
                    <div class="floor-tabs">
                        ${floors.map(f => `
                            <button class="floor-tab ${f === this._currentFloor ? 'active' : ''}"
                                onclick="NavigationPage.switchFloor('${f}')">${f} Floor</button>
                        `).join('')}
                    </div>
                    <div class="map-legend">
                        <span class="legend-item"><span class="legend-dot entrance"></span> Entrance</span>
                        <span class="legend-item"><span class="legend-dot room"></span> Room</span>
                        <span class="legend-item"><span class="legend-dot corridor"></span> Corridor</span>
                        <span class="legend-item"><span class="legend-dot elevator"></span> Elevator</span>
                        <span class="legend-item"><span class="legend-dot stairs"></span> Stairs</span>
                    </div>
                </div>
                <div class="map-container" id="map-container">
                    <svg id="hospital-map" viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg"></svg>
                </div>
            </div>

            <div id="nav-directions" class="directions-panel hidden"></div>
        </div>`;

        this.drawMap();
    },

    drawMap() {
        const svg = document.getElementById('hospital-map');
        if (!svg) return;

        const floorNodes = this._nodes.filter(n => n.floor === this._currentFloor);
        const floorNodeIds = new Set(floorNodes.map(n => n.node_id));
        const floorEdges = this._edges.filter(e =>
            floorNodeIds.has(e.from_node_id) && floorNodeIds.has(e.to_node_id)
        );

        let html = `<defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--primary)" opacity="0.5"/>
            </marker>
        </defs>`;

        // Background grid - using CSS variables if possible, or light equivalents
        html += `<rect width="1000" height="500" fill="#fff" rx="8"/>`;
        for (let x = 0; x <= 1000; x += 50) {
            html += `<line x1="${x}" y1="0" x2="${x}" y2="500" stroke="var(--border-light)" stroke-width="0.5"/>`;
        }
        for (let y = 0; y <= 500; y += 50) {
            html += `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="var(--border-light)" stroke-width="0.5"/>`;
        }

        // Draw edges
        floorEdges.forEach(e => {
            const from = floorNodes.find(n => n.node_id === e.from_node_id);
            const to = floorNodes.find(n => n.node_id === e.to_node_id);
            if (from && to) {
                const isOnRoute = this._isEdgeOnRoute(from.node_id, to.node_id);
                html += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"
                    stroke="${isOnRoute ? 'var(--primary)' : 'var(--border-light)'}" 
                    stroke-width="${isOnRoute ? 4 : 2}"
                    opacity="${isOnRoute ? 1 : 0.4}"/>`;
            }
        });

        // Draw route path on top with animation
        if (this._routeData) {
            const routeNodes = this._routeData.pathDetails.filter(n => n.floor === this._currentFloor);
            if (routeNodes.length > 1) {
                let pathD = `M ${routeNodes[0].x} ${routeNodes[0].y}`;
                for (let i = 1; i < routeNodes.length; i++) {
                    pathD += ` L ${routeNodes[i].x} ${routeNodes[i].y}`;
                }
                html += `<path d="${pathD}" stroke="var(--primary)" stroke-width="5" fill="none"
                    stroke-dasharray="10 5" class="route-path-anim"/>`;
            }
        }

        // Draw nodes
        floorNodes.forEach(n => {
            const colors = {
                entrance: 'var(--success)', room: 'var(--info)', corridor: 'var(--text-muted)',
                elevator: 'var(--warning)', stairs: '#a855f7'
            };
            const color = colors[n.node_type] || '#64748b';
            const isOnRoute = this._routeData && this._routeData.path.includes(n.node_id);
            const isOrigin = this._originNodeId === n.node_id;
            const isDest = this._routeData && this._routeData.to.node_id === n.node_id;
            const r = n.node_type === 'corridor' ? 5 : 8;

            if (isOrigin || isDest) {
                html += `<circle cx="${n.x}" cy="${n.y}" r="${r + 6}" fill="none"
                    stroke="${isOrigin ? '#22c55e' : '#ef4444'}" stroke-width="2" opacity="0.6" class="pulse-ring"/>`;
            }

            html += `<circle cx="${n.x}" cy="${n.y}" r="${r}"
                fill="${isOnRoute ? 'var(--primary)' : color}" stroke="#fff" stroke-width="${isOnRoute ? 2 : 1}"
                opacity="${isOnRoute ? 1 : 0.8}" class="map-node"
                data-node-id="${n.node_id}" onclick="NavigationPage.clickNode(${n.node_id})"/>`;

            // Labels for rooms and special nodes
            if (n.node_type !== 'corridor') {
                const shortLabel = n.label.length > 20 ? n.label.substring(0, 18) + '…' : n.label;
                html += `<text x="${n.x}" y="${n.y + r + 14}" text-anchor="middle"
                    fill="var(--text-secondary)" font-size="10" font-weight="500" font-family="Inter" class="node-label">${shortLabel}</text>`;
            }
        });

        svg.innerHTML = html;
    },

    _isEdgeOnRoute(fromId, toId) {
        if (!this._routeData) return false;
        const path = this._routeData.path;
        for (let i = 0; i < path.length - 1; i++) {
            if ((path[i] === fromId && path[i + 1] === toId) ||
                (path[i] === toId && path[i + 1] === fromId)) return true;
        }
        return false;
    },

    switchFloor(floor) {
        this._currentFloor = floor;
        document.querySelectorAll('.floor-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.floor-tab[onclick*="${floor}"]`)?.classList.add('active');
        this.drawMap();
    },

    setOrigin(nodeId) {
        if (!nodeId) { this._originNodeId = null; return; }
        this._originNodeId = parseInt(nodeId);
        const node = this._nodes.find(n => n.node_id === this._originNodeId);
        if (node) {
            const info = document.getElementById('nav-origin-info');
            info.classList.remove('hidden');
            info.innerHTML = `<span class="status-dot available"></span> Starting from: <strong>${node.label}</strong> (${node.floor} Floor)`;
            this._currentFloor = node.floor;
            document.querySelectorAll('.floor-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`.floor-tab[onclick*="${node.floor}"]`)?.classList.add('active');
            this.drawMap();
        }
    },

    async resolveQR() {
        const code = document.getElementById('nav-qr-input').value.trim();
        if (!code) { UI.toast('Enter a QR code', 'warning'); return; }
        try {
            const node = await API.resolveQR(code);
            document.getElementById('nav-origin').value = node.node_id;
            this.setOrigin(node.node_id);
            UI.toast(`Location identified: ${node.label}`, 'success');
        } catch (e) {
            UI.toast('QR code not recognized: ' + e.message, 'error');
        }
    },

    async findRoute() {
        const from = this._originNodeId || parseInt(document.getElementById('nav-origin').value);
        const to = parseInt(document.getElementById('nav-dest').value);
        if (!from || !to) { UI.toast('Select both origin and destination', 'warning'); return; }

        const btn = document.getElementById('nav-find-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Calculating...';

        try {
            const route = await API.getRoute(from, to);
            this._routeData = route;

            // Show directions
            const dirPanel = document.getElementById('nav-directions');
            dirPanel.classList.remove('hidden');
            dirPanel.innerHTML = `
                <div class="directions-header">
                    <h3> Route Found</h3>
                    <div class="route-meta">
                        <span class="route-stat"><strong>${route.totalDistance}</strong> units</span>
                        <span class="route-stat"><strong>${route.estimatedTime}</strong> min</span>
                        <span class="route-stat"><strong>${route.directions.length}</strong> steps</span>
                    </div>
                </div>
                <div class="direction-steps">
                    ${route.directions.map((d, i) => `
                        <div class="direction-step ${d.isDestination ? 'destination' : ''} ${d.floorChange ? 'floor-change' : ''}"
                             onclick="NavigationPage.switchFloor('${d.floor}')">
                            <span class="step-num">${d.step}</span>
                            <span class="step-text">${d.instruction}</span>
                            <span class="step-floor">${d.floor}</span>
                        </div>
                    `).join('')}
                </div>`;

            this.drawMap();
            UI.toast('Route calculated!', 'success');
        } catch (e) {
            UI.toast('Route error: ' + e.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg> Find Route`;
        }
    },

    clickNode(nodeId) {
        if (!this._originNodeId) {
            document.getElementById('nav-origin').value = nodeId;
            this.setOrigin(nodeId);
            UI.toast('Origin set', 'info');
        } else {
            document.getElementById('nav-dest').value = nodeId;
            UI.toast('Destination set', 'info');
        }
    }
};
