
function Routingtable(table, binary) {
    if (binary == true) {
        this.binary_table = table || ''; // Unicode packed table. Single address(12 bits)+dir(4 bits) or
    } else {
        this.table = table; // E.g '0703-0708=1,0815=2'. MUST always be in sort order!
    }
                               // Range from(12 bits)+0x1111+to(12 bits)+dir(4 bits)
    this.expanded = null;
    this.binary_expanded = null;
}

// Each room tile may have a single routing table

// A routing table is stored as a single string containing one or more
// comma separated KEY=VALUE pairs, where each pair indicates the
// next movement needed to reach one (XXYY) or more (XXY1-XXY2) consecutive
// tiles. The KEY order always sorted, this must not be tampered with.

// Typical use for lookups:
// var table = room.load_routing_table(X1Y1);
// var direction = table.getDirectionTo(X2Y2);

// Typical use for learning:
// var table = room.load_routing_table(X1Y1);
// table.setDirectionTo(X2Y2, direction); // Repeat for each destination
// room.save_routing_table(X1Y1, table);

// When making changes with setDirectionTo(), the routing table is expanded
// When saving the Routingtable, the caller is expected to access its contents
// via the .asString() method which (if needed) will compress the contents by
// aggregating consecutive tiles back into XXY1-XXY2 format.

Routingtable.prototype.asString = function() {
    this.compress();
    return this.table;
}

Routingtable.prototype.asBinaryString = function() {
    this.compress_binary();
    return this.binary_table;
}

Routingtable.prototype.getDirectionTo = function(address) {
    if (!_.isString(address)) {
        // Use binary format
        var table = this.binary_table;
        for (var i=0; i<table.length; i++) {
            var code1 = table.charCodeAt(i);
            var addr1 = code1 & 0x0000111111111111;
            if (addr1 > address) { return null; } // Address not in table
            var dir = code1>>24;
            if (dir == 0x1111) {
                // Range
                var code2 = table.charCodeAt(i++);
                var addr2 = code2 & 0x0000111111111111;
                dir = code2>>24;
                if (addr1 <= address && addr2 >= address) { return dir; } // Range match found
            } else {
                // Single address
                if (addr1 == address) { return dir; } // Address match found
            }
        }
        return null; // Address not in table
    }
    var a = address * 1;
    if (typeof this.table == 'undefined') { return null; }
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

Routingtable.prototype.setDirectionTo = function(address, direction) {
    if (this.getDirectionTo(address) == direction) { return; } // No change
    if (!_.isString(address)) {
        if (this.binary_expanded == null) { this.expand_binary(); }
        this.binary_expanded = this.binary_expanded.substring(0,address)+String.fromCharCode(direction)+this.binary_expanded.substring(address+1);
        return;
    }
    var a = address * 1;
    // Expand routing table while maintaining sort order
    if (this.expanded == null) {
        this.expanded = [];
        var routes = [];
        if (!(typeof this.table == 'undefined')) { routes = this.table.split(','); }
        for (var i=0; i<routes.length; i++) {
            var route = routes[i];
            var a1 = route.substring(0,4) * 1;
            if (route.charAt(4) == '=') {
        	    // Position ('XXYY=D')
                this.expanded.push(route);
            }
            if (route.charAt(4) == '-') {
                // Range ('XXYY-XXYY=D')
        	    var a2 = route.substring(5,9) * 1;
                for (var j=a1; j<=a2; j++) {
                    this.expanded.push(('00'+j).slice(-4)+'='+route.charAt(10)); // Format j as 'XXYY' with leading 0
                }
            }
        }
    }

    // Update/insert new entry
    var found = false;
    for (var i=0; i<this.expanded.length; i++) {
        var route = this.expanded[i];
        var a1 = route.substring(0,4) * 1;
        if (a1 < a) { continue; }
        if (a1 == a) {
            this.expanded[i] = address+'='+direction; // Update existing
            found = true;
            break;
        }
        if (a1 > a) {
            this.expanded.splice(i, 0, address+'='+direction); // Found insertion point
            found = true;
            break;
        }
    }
    if (found == false) {
        // Update/insertion point not reached, append new entry
        this.expanded.push(address+'='+direction);
    }

}

Routingtable.prototype.compress = function() {
    if (this.expanded == null) { return; }
    // Compress routing table
    var routes = [];
    var span_a1 = null;
    var span_a2 = null;
    var span_dir = null;
    for (var i=0; i<this.expanded.length; i++) {
        var route = this.expanded[i];
        var addr = route.substring(0,4) * 1;
        var dir = route.charAt(5);
        if (span_a1 == null) {
            // Start new span
            span_a1 = addr;
            span_a2 = addr;
            span_dir = dir;
            continue;
        }
        if (span_dir == dir && span_a2*1 + 1 == addr*1) {
            // Continue span
            span_a2 = addr;
            continue;
        }
        // Finish span and start a new one
        routes.push(span_a1 == span_a2 ? ('00'+span_a1).slice(-4)+'='+span_dir : ('00'+span_a1).slice(-4)+'-'+('00'+span_a2).slice(-4)+'='+span_dir);
        span_a1 = addr;
        span_a2 = addr;
        span_dir = dir;
    }
    if (span_a1 != null) {
        // Finish last span
        routes.push(span_a1 == span_a2 ? ('00'+span_a1).slice(-4)+'='+span_dir : ('00'+span_a1).slice(-4)+'-'+('00'+span_a2).slice(-4)+'='+span_dir);
    }
    this.table = routes.join(',');
}

Routingtable.prototype.expand_binary = function() {
    this.binary_expanded = (String.fromCharCode(0)).repeat(2500); // Skeleton
    var table = this.binary_table;
    for (var i=0; i<table.length; i++) {
        var code1 = table.charCodeAt(i);
        var addr1 = code1 & 0x0000111111111111;
        var dir = code1>>24;
        if (dir == 0x1111) {
            // Range
            var code2 = table.charCodeAt(i++);
            var addr2 = code2 & 0x0000111111111111;
            dir = code2>>24;
            this.binary_expanded = this.binary_expanded.substring(0,addr1)+(String.fromCharCode(dir)).repeat(addr2-addr1)+this.binary_expanded.substring(addr2+1);
        } else {
            // Single address
            this.binary_expanded = this.binary_expanded.substring(0,addr1)+String.fromCharCode(dir)+this.binary_expanded.substring(addr1+1);
        }

    }
}

Routingtable.prototype.compress_binary = function() {
    this.binary_table = '';
    if (this.binary_expanded == null) { return; }
    var span_a1 = null;
    var span_a2 = null;
    var span_dir = null;
    for (var addr=0; addr<2500; addr++) {
        var dir = this.binary_expanded.charCodeAt(addr);
        if (span_dir == null) { span_a1 = addr; span_dir = dir; continue; }
        if (span_dir == dir) { span_a2 = addr; continue; }
        if (span_dir != dir) {
            this.add_span(span_a1, span_a2, span_dir);
            span_a1 = addr; span_a2 = null; span_dir = dir; continue;
        }
    }
    this.add_span(span_a1, span_a2, span_dir);
}

Routingtable.prototype.add_span = function(addr1, addr2, dir) {
    if (addr2 == null) {
        // Single address
        var code = dir<<24;
        this.binary_table = this.binary_table + String.fromCharCode(addr1 | code);
    } else {
        // Address range
        this.binary_table = this.binary_table + String.fromCharCode(addr1 | 0x1111000000000000) + String.fromCharCode(addr2 | code);
    }
}

module.exports = Routingtable;
