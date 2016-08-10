
function Routingtable(table) {
    this.table = table; // E.g '0703-0708=1,0815=2'. MUST always be in sort order!

    getDirectionTo: function(address) {
        var a = address * 1;
        var routes = this.table.split(',');
        for (var i=0; i<routes.length; i++) {
            var route = routes[i];
            var a1 = route.substring(0,4) * 1;
            if (route.charAt(4) == '=') {
        	    // Position ('XXYY=D')
                if (a1 < a) { continue; } // Keep searching
                if (a1 == a) { return route.charAt(5); }
                if (a1 > a) { return null; }
            }
            if (route.charAt(4) == '-') {
                // Range ('XXYY-XXYY=D')
        	    var a2 = route.substring(5,9) * 1;
                if (a2 < a) { continue; } // Keep searching
                if (a1 <= a && a <= a2) { return route.charAt(10); }
                if (a2 > a) { return null; }
            }
        }
    }

    setDirectionTo: function(address, direction) {
        if (this.getDirectionTo(address) == direction) { return; } // No change
        var a = address * 1;
        var expanded = [];
        // Expand routing table while maintaining sort order
        var routes = this.table.split(',');
        for (var i=0; i<routes.length; i++) {
            var route = routes[i];
            var a1 = route.substring(0,4) * 1;
            if (route.charAt(4) == '=') {
        	    // Position ('XXYY=D')
                expanded.push(route);
            }
            if (route.charAt(4) == '-') {
                // Range ('XXYY-XXYY=D')
        	    var a2 = route.substring(5,9) * 1;
                for (var j=a1; j<=a2; j++) {
                    expanded.push(('0'+j).slice(-4)+'='+route.charAt(10)); // Format j as 'XXYY' with leading 0
                }
            }
        }
        // Update/insert new entry
        var found = false;
        for (var i=0; i<expanded.length; i++) {
            var route = expanded[i];
            var a1 = route.substring(0,4) * 1;
            if (a1 < a) { continue; }
            if (a1 == a) {
                expanded[i] = address+'='+direction; // Update existing
                found = true;
                break;
            }
            if (a1 > a) {
                expanded.splice(i, 0, address+'='+direction); // Found insertion point
                found = true;
                break;
            }
        }
        if (found == false) {
            // Update/insertion point not reached, append new entry
            expanded.push(address+'='+direction);
        }

        // Compress routing table
        routes = [];
        var span_a1 = null;
        var span_a2 = null;
        var span_dir = null;
        for (var i=0; i<expanded.length; i++) {
            var route = expanded[i];
            var addr = route.substring(0,4) * 1;
            var dir = route.charAt(5);
            if (span_a1 == null) {
                // Start new span
                span_a1 = addr;
                span_a2 = addr;
                span_dir = dir;
                continue;
            }
            if (span_dir == dir) {
                // Continue span
                span_a2 = addr;
                continue;
            }
            // Finish span and start a new one
            routes.push(span_a1 == span_a2 ? span_a1+'='+span_dir : span_a1+'-'+span_a2+'='+span_dir);
            span_a1 = addr;
            span_a2 = addr;
            span_dir = dir;
        }
        if (span_a1 != null) {
            // Finish last span
            routes.push(span_a1 == span_a2 ? span_a1+'='+span_dir : span_a1+'-'+span_a2+'='+span_dir);
        }
        this.table = routes.join(',');
    }
}

module.exports = Routingtable;
