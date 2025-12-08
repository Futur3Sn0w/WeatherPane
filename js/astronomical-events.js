// Astronomical events database and card updater
// Comprehensive database of major astronomical events (2025-2027)

const astronomicalEvents = [
    // 2025 Events
    {
        name: "Quadrantids Meteor Shower Peak",
        date: new Date("2025-01-03T10:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (best after midnight)",
        details: "Up to 120 meteors/hour at peak"
    },
    {
        name: "Partial Lunar Eclipse",
        date: new Date("2025-03-14T06:58:00Z"),
        type: "Lunar Eclipse",
        visibility: "Americas, Europe, Africa",
        details: "Moon passes through Earth's penumbra"
    },
    {
        name: "Partial Solar Eclipse",
        date: new Date("2025-03-29T10:48:00Z"),
        type: "Solar Eclipse",
        visibility: "North America, Europe",
        details: "Partial eclipse visible from multiple continents"
    },
    {
        name: "Lyrids Meteor Shower Peak",
        date: new Date("2025-04-22T08:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (best after midnight)",
        details: "Up to 20 meteors/hour, debris from Comet Thatcher"
    },
    {
        name: "Eta Aquarids Meteor Shower Peak",
        date: new Date("2025-05-06T10:00:00Z"),
        type: "Meteor Shower",
        visibility: "Best in Southern Hemisphere",
        details: "Up to 60 meteors/hour, debris from Halley's Comet"
    },
    {
        name: "June Solstice",
        date: new Date("2025-06-21T02:42:00Z"),
        type: "Solstice",
        visibility: "Worldwide",
        details: "Summer solstice (Northern) / Winter (Southern)"
    },
    {
        name: "Perseids Meteor Shower Peak",
        date: new Date("2025-08-12T16:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (Northern Hemisphere favored)",
        details: "Up to 100 meteors/hour, one of the best annual showers"
    },
    {
        name: "Partial Lunar Eclipse",
        date: new Date("2025-09-07T18:11:00Z"),
        type: "Lunar Eclipse",
        visibility: "Europe, Africa, Asia, Australia",
        details: "Moon partially enters Earth's umbra"
    },
    {
        name: "Annular Solar Eclipse",
        date: new Date("2025-09-21T19:43:00Z"),
        type: "Solar Eclipse",
        visibility: "Pacific, South America",
        details: "Ring of fire eclipse visible from path"
    },
    {
        name: "September Equinox",
        date: new Date("2025-09-22T18:19:00Z"),
        type: "Equinox",
        visibility: "Worldwide",
        details: "Autumn equinox (Northern) / Spring (Southern)"
    },
    {
        name: "Orionids Meteor Shower Peak",
        date: new Date("2025-10-21T12:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide",
        details: "Up to 25 meteors/hour, debris from Halley's Comet"
    },
    {
        name: "Geminids Meteor Shower Peak",
        date: new Date("2025-12-14T07:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide",
        details: "Up to 120 meteors/hour, one of the best annual showers"
    },
    {
        name: "December Solstice",
        date: new Date("2025-12-21T15:03:00Z"),
        type: "Solstice",
        visibility: "Worldwide",
        details: "Winter solstice (Northern) / Summer (Southern)"
    },
    {
        name: "Ursids Meteor Shower Peak",
        date: new Date("2025-12-22T12:00:00Z"),
        type: "Meteor Shower",
        visibility: "Northern Hemisphere",
        details: "Up to 10 meteors/hour"
    },

    // 2026 Events
    {
        name: "Quadrantids Meteor Shower Peak",
        date: new Date("2026-01-04T04:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (best after midnight)",
        details: "Up to 120 meteors/hour at peak"
    },
    {
        name: "Total Lunar Eclipse",
        date: new Date("2026-03-03T11:33:00Z"),
        type: "Lunar Eclipse",
        visibility: "Americas, Europe, Africa, Asia",
        details: "Total eclipse - Blood Moon visible"
    },
    {
        name: "March Equinox",
        date: new Date("2026-03-20T14:46:00Z"),
        type: "Equinox",
        visibility: "Worldwide",
        details: "Spring equinox (Northern) / Autumn (Southern)"
    },
    {
        name: "Lyrids Meteor Shower Peak",
        date: new Date("2026-04-22T20:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (best after midnight)",
        details: "Up to 20 meteors/hour"
    },
    {
        name: "Eta Aquarids Meteor Shower Peak",
        date: new Date("2026-05-06T06:00:00Z"),
        type: "Meteor Shower",
        visibility: "Best in Southern Hemisphere",
        details: "Up to 60 meteors/hour"
    },
    {
        name: "June Solstice",
        date: new Date("2026-06-21T08:24:00Z"),
        type: "Solstice",
        visibility: "Worldwide",
        details: "Summer solstice (Northern) / Winter (Southern)"
    },
    {
        name: "Perseids Meteor Shower Peak",
        date: new Date("2026-08-13T04:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (Northern Hemisphere favored)",
        details: "Up to 100 meteors/hour"
    },
    {
        name: "Total Solar Eclipse",
        date: new Date("2026-08-12T17:47:00Z"),
        type: "Solar Eclipse",
        visibility: "Arctic, Greenland, Iceland, Spain",
        details: "Total solar eclipse - path of totality across Europe"
    },
    {
        name: "Partial Lunar Eclipse",
        date: new Date("2026-08-28T04:13:00Z"),
        type: "Lunar Eclipse",
        visibility: "Americas, Europe, Africa",
        details: "Partial lunar eclipse visible"
    },
    {
        name: "September Equinox",
        date: new Date("2026-09-23T00:05:00Z"),
        type: "Equinox",
        visibility: "Worldwide",
        details: "Autumn equinox (Northern) / Spring (Southern)"
    },
    {
        name: "Orionids Meteor Shower Peak",
        date: new Date("2026-10-21T18:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide",
        details: "Up to 25 meteors/hour"
    },
    {
        name: "Geminids Meteor Shower Peak",
        date: new Date("2026-12-14T12:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide",
        details: "Up to 120 meteors/hour"
    },
    {
        name: "December Solstice",
        date: new Date("2026-12-21T20:50:00Z"),
        type: "Solstice",
        visibility: "Worldwide",
        details: "Winter solstice (Northern) / Summer (Southern)"
    },

    // 2027 Events
    {
        name: "Quadrantids Meteor Shower Peak",
        date: new Date("2027-01-03T22:00:00Z"),
        type: "Meteor Shower",
        visibility: "Worldwide (best after midnight)",
        details: "Up to 120 meteors/hour at peak"
    },
    {
        name: "Penumbral Lunar Eclipse",
        date: new Date("2027-02-20T23:13:00Z"),
        type: "Lunar Eclipse",
        visibility: "Americas, Europe, Africa, Asia",
        details: "Subtle shading on Moon's surface"
    },
    {
        name: "March Equinox",
        date: new Date("2027-03-20T20:25:00Z"),
        type: "Equinox",
        visibility: "Worldwide",
        details: "Spring equinox (Northern) / Autumn (Southern)"
    },
    {
        name: "Total Lunar Eclipse",
        date: new Date("2027-07-18T16:02:00Z"),
        type: "Lunar Eclipse",
        visibility: "Americas, Europe, Africa",
        details: "Total lunar eclipse - Blood Moon"
    },
    {
        name: "Total Solar Eclipse",
        date: new Date("2027-08-02T10:07:00Z"),
        type: "Solar Eclipse",
        visibility: "North Africa, Middle East",
        details: "Total eclipse with 6+ minutes of totality"
    },
    {
        name: "Penumbral Lunar Eclipse",
        date: new Date("2027-08-17T07:13:00Z"),
        type: "Lunar Eclipse",
        visibility: "Asia, Australia, Pacific",
        details: "Penumbral eclipse"
    }
];

function findNextAstronomicalEvent() {
    const now = new Date();

    // Filter future events and sort by date
    const futureEvents = astronomicalEvents
        .filter(event => event.date > now)
        .sort((a, b) => a.date - b.date);

    if (futureEvents.length === 0) {
        return null;
    }

    return {
        current: futureEvents[0],
        next: futureEvents[1] || null
    };
}

function formatEventDate(date) {
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Format the full date
    const dateStr = date.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    if (diffDays === 0) {
        return "Today!";
    } else if (diffDays === 1) {
        return "Tomorrow";
    } else if (diffDays < 7) {
        return `in ${diffDays} days`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `in ${months} month${months !== 1 ? 's' : ''}`;
    } else {
        return dateStr;
    }
}

function formatEventDateTime(date) {
    const timeStr = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
    const dateStr = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    return `${dateStr} at ${timeStr}`;
}

function updateAstronomicalEventsCard() {
    const events = findNextAstronomicalEvent();

    if (!events || !events.current) {
        setDetailText('astroEventName', 'No upcoming events');
        setDetailText('astroEventDate', '—');
        setDetailText('astroEventType', '—');
        setDetailText('astroEventDateTime', '—');
        setDetailText('astroEventVisibility', '—');
        setDetailText('astroNextEvent', '—');
        return;
    }

    const { current, next } = events;

    // Update summary section
    $('#astroEventName').text(current.name);
    $('#astroEventDate').text(formatEventDate(current.date));

    // Update detail section
    setDetailText('astroEventType', current.type);
    setDetailText('astroEventDateTime', formatEventDateTime(current.date));
    setDetailText('astroEventVisibility', current.visibility);

    if (next) {
        const nextStr = `${next.name} (${formatEventDate(next.date)})`;
        setDetailText('astroNextEvent', nextStr);
    } else {
        setDetailText('astroNextEvent', 'None in database');
    }
}
