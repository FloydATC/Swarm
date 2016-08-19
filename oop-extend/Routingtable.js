
function Routingtable(table) {
    this.binary_table = table || ''; // Unicode packed table. Single address(12 bits)+dir(4 bits) or
                                    // Range from(12 bits)+0x1111+to(12 bits)+dir(4 bits)
    //console.log(this+' load as binary string (length='+this.binary_table.length+')');
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

Routingtable.prototype.asBinaryString = function() {
    this.compress_binary();
    //console.log(this+' save as binary string (length='+this.binary_table.length+')');
    return this.binary_table;
}

Routingtable.prototype.getDirectionTo = function(address) {
    // Use binary format
    //console.log(this+' lookup address '+address);
    var table = this.binary_table;
    for (var i=0; i<table.length; i++) {
        var code1 = table.charCodeAt(i);
        var addr1 = code1 & 0x0fff;
        //console.log('  found '+addr1);
        if (addr1 > address) { return null; } // Address not in table
        var dir = code1>>12;
        if (dir == 0) {
            // Range
            var code2 = table.charCodeAt(i++);
            var addr2 = code2 & 0x0fff;
            //console.log('  spans to '+addr2);
            dir = code2>>12;
            if (addr1 <= address && addr2 >= address) { return dir; } // Range match found
        } else {
            // Single address
            //console.log('  single address');
            if (addr1 == address) { return dir; } // Address match found
        }
    }
    //console.log('  not found');
    return null; // Address not in table
}

Routingtable.prototype.setDirectionTo = function(address, direction) {
    if (direction == 0 || this.getDirectionTo(address) == direction) { return; } // No change
    if (this.binary_expanded == null) { this.expand_binary(); }
    console.log(this+' learn address '+address+' direction '+direction);
    //this.binary_expanded = this.binary_expanded.substring(0,address)+String.fromCharCode(direction)+this.binary_expanded.substring(address+1);
    //this.binary_expanded[address] = direction;
    var newcode = direction<<12;
    for (var i=0; i<this.binary_expanded.length; i++) {
        var code = this.binary_expanded.charCodeAt(i);
        var addr = code & 0x0fff;
        if (addr == address) {
            console.log('overwrite offset '+i);
            this.binary_expanded = this.binary_expanded.substring(0,i) + String.fromCharCode(address | newcode) + this.binary_expanded.substring(i+2);
            return;
        }
        if (addr > address) {
            console.log('insert at offset '+i);
            this.binary_expanded = this.binary_expanded.substring(0,i) + String.fromCharCode(address | newcode) + this.binary_expanded.substring(i+1);
            return;
        }
    }
    console.log('append');
    this.binary_expanded = this.binary_expanded + String.fromCharCode(address | newcode);
    return;
}

Routingtable.prototype.expand_binary = function() {
    this.binary_expanded = '';
    this.binary_debug = '';
    var table = this.binary_table;
    for (var i=0; i<table.length; i++) {
        var code1 = table.charCodeAt(i);
        var addr1 = code1 & 0x0fff;
        var dir = code1>>12;
        //console.log('code '+code1+' contains address '+addr1+' direction '+dir);
        if (dir == 0) {
            // Range
            var code2 = table.charCodeAt(i++);
            var addr2 = code2 & 0x0fff;
            dir = code2>>12;
            for (var addr=addr1; addr<=addr2; addr++) {
                this.binary_expanded = this.binary_expanded + String.fromCharCode(addr | (code2 && 0xf000));
            }
            //this.binary_expanded = this.binary_expanded.substring(0,addr1)+(String.fromCharCode(dir)).repeat(addr2-addr1)+this.binary_expanded.substring(addr2+1);
            this.binary_debug = this.binary_debug + addr1 + '-' + addr2 + '=' + dir + ';';
        } else {
            // Single address
            this.binary_expanded = this.binary_expanded + code1;
            //this.binary_expanded = this.binary_expanded.substring(0,addr1)+String.fromCharCode(dir)+this.binary_expanded.substring(addr1+1);
            this.binary_debug = this.binary_debug + addr1 + '=' + dir + ';';
        }

    }
    console.log('Expanded '+this.binary_debug);
}

Routingtable.prototype.compress_binary = function() {
    this.binary_table = '';
    this.binary_debug = '';
    if (this.binary_expanded == null) { return; }
    var span_a1 = null;
    var span_a2 = null;
    var span_dir = null;
    for (var i=0; i<this.binary_expanded.length; i++) {
        var code = this.binary_expanded.charCodeAt(i);
        var addr = code & 0x0fff;
        var dir = code>>12;
        //console.log('must compress code='+code+' addr='+addr+' dir='+dir);
        if (span_dir == dir) { span_a2 = addr; continue; }
        if (span_dir != dir) {
            this.add_span(span_a1, span_a2, span_dir);
            span_a1 = addr; span_a2 = null; span_dir = dir; continue;
        }
    }
    this.add_span(span_a1, span_a2, span_dir);
    console.log('Compressed '+this.binary_debug);
}

Routingtable.prototype.add_span = function(addr1, addr2, dir) {
    if (dir == 0 || dir == null) { return; } // Do not store 0 (unknown) direction
    if (addr2 == null) {
        // Single address
        var code = dir<<12;
        this.binary_table = this.binary_table + String.fromCharCode(addr1 | code);
        this.binary_debug = this.binary_debug + addr1+'='+dir+';';
    } else {
        // Address range
        this.binary_table = this.binary_table + String.fromCharCode(addr1) + String.fromCharCode(addr2 | code);
        this.binary_debug = this.binary_debug + addr1+'-'+addr2+'='+dir+';';
    }
}

module.exports = Routingtable;
