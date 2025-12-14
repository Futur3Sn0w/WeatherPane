// Card rendering engine for WeatherPane
// Loads card definitions from card-definitions.json and renders them dynamically

// Global variable to store loaded card definitions
let CARD_DEFINITIONS = [];

// Load card definitions from JSON file
async function loadCardDefinitions() {
    try {
        const response = await fetch('card-definitions.json');
        if (!response.ok) {
            throw new Error(`Failed to load card definitions: ${response.status} ${response.statusText}`);
        }
        CARD_DEFINITIONS = await response.json();
        console.log(`[Card Renderer] Loaded ${CARD_DEFINITIONS.length} card definitions`);
        return CARD_DEFINITIONS;
    } catch (error) {
        console.error('[Card Renderer] Error loading card definitions:', error);
        throw error;
    }
}

// Render control buttons for a card
function renderControls(controls, dataCard) {
    let html = '<div class="card-controls">';

    if (controls.type === 'multi') {
        // Multiple control groups (e.g., day toggle + temp unit)
        controls.groups.forEach(group => {
            html += renderControlGroup(group, dataCard);
        });
    } else {
        // Single control group
        html += renderControlGroup(controls, dataCard);
    }

    html += '</div>';
    return html;
}

// Render a single control group
function renderControlGroup(group, cardDataType) {
    let html = '';
    const groupClass = group.type === 'segmented' ? 'control-group segmented' : 'control-group';

    html += `<div class="${groupClass}">`;

    group.buttons.forEach(button => {
        const activeClass = button.active ? ' active' : '';
        const titleAttr = button.title ? ` title="${button.title}"` : '';
        const dataValue = button.value ? ` data-value="${button.value}"` : '';
        const dataCardAttr = ` data-card="${cardDataType}"`;

        if (button.icon) {
            // Icon button
            html += `<button class="control-btn icon-btn${activeClass}" id="${button.id}"${titleAttr}${dataValue}${dataCardAttr}>`;
            html += `<i class="fa-solid fa-${button.icon}"></i>`;
            html += `</button>`;
        } else {
            // Text button
            html += `<button class="control-btn${activeClass}" id="${button.id}"${titleAttr}${dataValue}${dataCardAttr}>`;
            html += button.text;
            html += `</button>`;
        }
    });

    html += '</div>';
    return html;
}

// Render a single card from its definition
function renderCard(cardDef) {
    let html = `<article class="card" id="${cardDef.id}" data-card="${cardDef.dataCard}" tabindex="0" role="button" aria-expanded="false">`;

    // Render badges
    if (cardDef.badges && cardDef.badges.length > 0) {
        html += '<div class="badges">';
        cardDef.badges.forEach(badge => {
            const titleAttr = badge.title ? ` title="${badge.title}"` : '';
            if (badge.html) {
                html += `<span class="status-badge ${badge.class}" id="${badge.id}"${titleAttr}>${badge.html}</span>`;
            } else {
                html += `<span class="status-badge ${badge.class}" id="${badge.id}"${titleAttr}>${badge.text}</span>`;
            }
        });
        html += '</div>';
    }

    // Render controls
    if (cardDef.controls) {
        html += renderControls(cardDef.controls, cardDef.dataCard);
    }

    // Render summary
    html += '<div class="card-summary">';
    html += `<h3>${cardDef.title}</h3>`;

    if (cardDef.summary.customHTML) {
        // Custom HTML for complex layouts
        html += cardDef.summary.customHTML;
    } else if (cardDef.summary.hasDayToggle) {
        // Today/Tomorrow toggle layout
        html += renderDayToggleData('today', cardDef.summary.todayData, cardDef.dataCard);
        html += renderDayToggleData('tomorrow', cardDef.summary.tomorrowData, cardDef.dataCard);
    } else {
        // Standard layout
        html += renderStandardSummary(cardDef.summary);
    }

    html += '</div>'; // End card-summary

    // Render details
    html += '<div class="card-detail">';

    if (cardDef.details) {
        if (cardDef.details.hasDayToggle) {
            // Today/Tomorrow toggle in details
            html += renderDayToggleDetails('today', cardDef.details.todayData, cardDef.dataCard);
            html += renderDayToggleDetails('tomorrow', cardDef.details.tomorrowData, cardDef.dataCard);
        } else if (Array.isArray(cardDef.details)) {
            // Standard detail grid
            html += '<div class="detail-grid">';
            cardDef.details.forEach(detail => {
                html += `
                    <div>
                        <span class="detail-label">${detail.label}</span>
                        <span class="detail-value" id="${detail.id}">—</span>
                    </div>
                `;
            });
            html += '</div>';
        }
    }

    html += '</div>'; // End card-detail

    // Add extra HTML if present (like moon slider)
    if (cardDef.extraHTML) {
        html += cardDef.extraHTML;
    }

    html += '</article>';
    return html;
}

// Helper function to render day toggle data (today/tomorrow)
function renderDayToggleData(dayType, data, dataCard) {
    if (!data) return '';

    const className = `${dataCard}-${dayType}-data`;
    const displayStyle = dayType === 'tomorrow' ? ' style="display: none;"' : '';

    let html = `<div class="${className}"${displayStyle}>`;

    if (data.metrics || data.pills || data.kicker) {
        if (data.metrics && data.metrics.length > 0) {
            const hasRow = data.pills && data.pills.length > 0;

            if (hasRow) {
                html += '<div class="row">';
            }

            html += '<div class="metric">';
            data.metrics.forEach(metric => {
                html += `<span class="value" id="${metric.id}">${metric.text || '—'}</span>`;
                if (metric.suffix) {
                    html += `<small id="${metric.suffix}"></small>`;
                } else if (metric.smallSuffix) {
                    html += `<small>${metric.smallSuffix}</small>`;
                }
            });
            html += '</div>';

            if (data.pills) {
                data.pills.forEach(pill => {
                    const styleAttr = pill.style ? ` style="${pill.style}"` : '';
                    const idAttr = pill.id ? ` id="${pill.id}"` : '';
                    html += `<span class="pill"${styleAttr}${idAttr}>${pill.text}</span>`;
                });
            }

            if (hasRow) {
                html += '</div>';
            }
        }

        if (data.kicker) {
            html += `<div class="kicker" id="${data.kicker.id}">${data.kicker.text}</div>`;
        }
    }

    html += '</div>';
    return html;
}

// Helper function to render day toggle details
function renderDayToggleDetails(dayType, details, dataCard) {
    if (!details) return '';

    const className = `${dataCard}-${dayType}-data`;
    const displayStyle = dayType === 'tomorrow' ? ' style="display: none;"' : '';

    let html = `<div class="${className}"${displayStyle}>`;
    html += '<div class="detail-grid">';

    if (details) {
        details.forEach(detail => {
            html += `
                <div>
                    <span class="detail-label">${detail.label}</span>
                    <span class="detail-value" id="${detail.id}">—</span>
                </div>
            `;
        });
    }

    html += '</div>';
    html += '</div>';
    return html;
}

// Helper function to render standard summary (non-toggle)
function renderStandardSummary(summary) {
    let html = '';

    if (summary.metrics) {
        html += '<div class="row">';
        html += '<div class="metric">';
        summary.metrics.forEach(metric => {
            const textContent = metric.text || '—';
            if (metric.isValue) {
                // Special case for values that aren't split into value/suffix
                html += `<span class="value" id="${metric.id}">${textContent}</span>`;
            } else {
                html += `<span class="value" id="${metric.id}">${textContent}</span>`;
                if (metric.suffix) {
                    html += `<small id="${metric.suffix}"></small>`;
                }
            }
        });
        html += '</div>';

        if (summary.pills) {
            summary.pills.forEach(pill => {
                const styleAttr = pill.style ? ` style="${pill.style}"` : '';
                const idAttr = pill.id ? ` id="${pill.id}"` : '';
                html += `<span class="pill"${styleAttr}${idAttr}>${pill.text}</span>`;
            });
        }
        html += '</div>';
    }

    if (summary.kicker) {
        html += `<div class="kicker" id="${summary.kicker.id}">${summary.kicker.text}</div>`;
    }

    return html;
}

// Main function to render all cards into a container
async function renderAllCards(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[Card Renderer] Container with ID "${containerId}" not found`);
        return;
    }

    // Load card definitions if not already loaded
    if (CARD_DEFINITIONS.length === 0) {
        await loadCardDefinitions();
    }

    let html = '';
    CARD_DEFINITIONS.forEach(cardDef => {
        html += renderCard(cardDef);
    });

    container.innerHTML = html;
    console.log(`[Card Renderer] Rendered ${CARD_DEFINITIONS.length} cards into #${containerId}`);
}

// Initialize cards when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[Card Renderer] DOM ready, rendering cards...');
    try {
        await renderAllCards('todayGrid');
    } catch (error) {
        console.error('[Card Renderer] Failed to render cards:', error);
    }
});
