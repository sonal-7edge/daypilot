import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import org.kde.plasma.core 2.0 as PlasmaCore
import org.kde.plasma.components 3.0 as PlasmaComponents

Item {
    id: root
    width: 360
    height: 420

    property string serverUrl: "https://daypilot-1hr8.onrender.com"
    property var roomData: []

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        Text {
            text: "Daypilot"
            font.pixelSize: 18
            font.bold: true
            color: PlasmaCore.Theme.textColor
        }

        RowLayout {
            spacing: 6
            PlasmaComponents.Button {
                text: "Meeting"
                flat: currentMode !== 0
                onClicked: currentMode = 0
            }
            PlasmaComponents.Button {
                text: "Focus"
                flat: currentMode !== 1
                onClicked: currentMode = 1
            }
        }

        property int currentMode: 0

        PlasmaComponents.TextField {
            id: jiraKeyInput
            Layout.fillWidth: true
            placeholderText: "Jira key (e.g. AUTH-123) — optional"
            visible: parent.currentMode === 0
        }

        PlasmaComponents.TextField {
            id: titleInput
            Layout.fillWidth: true
            placeholderText: parent.currentMode === 1 ? "Focus block title" : "Event title"
        }

        RowLayout {
            spacing: 6
            PlasmaComponents.TextField {
                id: dateInput
                Layout.fillWidth: true
                placeholderText: "YYYY-MM-DD"
                text: Qt.formatDate(new Date(), "yyyy-MM-dd")
            }
            PlasmaComponents.TextField {
                id: startInput
                implicitWidth: 70
                placeholderText: "09:00"
            }
            Text { text: "→"; color: PlasmaCore.Theme.textColor }
            PlasmaComponents.TextField {
                id: endInput
                implicitWidth: 70
                placeholderText: "10:00"
            }
        }

        PlasmaComponents.ComboBox {
            id: roomCombo
            Layout.fillWidth: true
            visible: parent.currentMode === 0
            model: ["No room"]
            Component.onCompleted: loadRooms()
        }

        Text {
            id: statusText
            Layout.fillWidth: true
            text: ""
            wrapMode: Text.Wrap
            font.pixelSize: 12
        }

        PlasmaComponents.Button {
            Layout.fillWidth: true
            text: parent.currentMode === 1 ? "Block Focus Time" : "Add to Calendar"
            onClicked: submitEvent()
        }
    }

    function loadRooms() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", serverUrl + "/api/calendar/rooms");
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                roomData = JSON.parse(xhr.responseText);
                var names = ["No room"].concat(roomData.map(function(r) { return r.resourceName; }));
                roomCombo.model = names;
            }
        };
        xhr.send();
    }

    function submitEvent() {
        var tz = "+05:30";
        var start = dateInput.text + "T" + startInput.text + ":00" + tz;
        var end = dateInput.text + "T" + endInput.text + ":00" + tz;
        var isFocus = root.children[0].currentMode === 1;
        var endpoint = isFocus ? "/api/calendar/focus" : "/api/calendar/event";
        var payload = { title: titleInput.text, start: start, end: end };

        if (!isFocus) {
            if (jiraKeyInput.text) payload.jiraKey = jiraKeyInput.text;
            if (roomCombo.currentIndex > 0) payload.roomResourceEmail = roomData[roomCombo.currentIndex - 1].resourceEmail;
        }

        var xhr = new XMLHttpRequest();
        xhr.open("POST", serverUrl + endpoint);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                statusText.text = xhr.status === 200 ? "Done! Added to calendar." : "Error — check server logs.";
                if (xhr.status === 200) { titleInput.text = ""; jiraKeyInput.text = ""; }
            }
        };
        xhr.send(JSON.stringify(payload));
    }
}
