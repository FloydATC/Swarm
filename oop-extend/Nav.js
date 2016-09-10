
var Routingtable = require('Routingtable');

module.exports = {
    learn_path: function(src, final, path) {
        console.log('NAV> learn_path('+src+', '+final+', '+path+')');
        var from = src;
        var table = null;
        for (var i=0; i<path.length; i++) {
            var next = path[i];
            var vec = { x: next.x-from.x, y: next.y-from.y };
            var dir = module.exports.direction_of_vector(vec);
            //console.log('  vec='+JSON.stringify(vec)+' dir='+dir);
            // From 'tile', the following destinations are all reachable by moving in direction 'dir'
            //console.log('  innerloop i='+i);
            var tilename = ('0'+from.x).slice(-2) + ('0'+from.y).slice(-2); // Format as XXYY
            for (var j=i; j<path.length; j++) {
                var dest = path[j];
                var tablename = (from.roomName === dest.roomName ? 'local' : dest.roomName);
                if (table == null || table.roomname != from.roomName || table.tilename != tilename || table.tablename != tablename) {
                    if (table != null) {
                        module.exports.set_table(table.roomname, table.tilename, table.tablename, table);
                    }
                    table = module.exports.get_table(from.roomName, tilename, tablename);
                    table.roomname = from.roomName;
                    table.tilename = tilename;
                    table.tablename = tablename;
                }
                console.log('NAV>     from '+from+' move '+dir+' to reach '+dest);
                table.setDirectionTo(dest.x + (dest.y * 50), dir);
            }
            var tablename = (from.roomName === dest.roomName ? 'local' : dest.roomName);
            if (table == null || table.roomname != from.roomName || table.tilename != tilename || table.tablename != tablename) {
                if (table != null) {
                    module.exports.set_table(table.roomname, table.tilename, table.tablename, table);
                }
                table = module.exports.get_table(from.roomName, tilename, tablename);
                table.roomname = from.roomName;
                table.tilename = tilename;
                table.tablename = tablename;
            }
            console.log('NAV>     from '+from+' move '+dir+' to reach '+final+' (final)');
            table.setDirectionTo(final.x + (final.y * 50), dir);
            module.exports.set_table(table.roomname, table.tilename, table.tablename, table);

            from = next;
            if (from.roomName != src.roomName) { return; } // Limit learning to current room
        }
    },

    get_direction: function(src, dst) {
        var tilename = ('0'+src.x).slice(-2) + ('0'+src.y).slice(-2); // Format as XXYY
        var tablename = (src.roomName === dst.roomName ? 'local' : dst.roomName);
        var table = module.exports.get_table(src.roomName, tilename, tablename);
        var dir = table.getDirectionTo(dst.x + (50 * dst.y));
        console.log('NAV>     get_direction('+src+','+dst+') = '+dir);
        return dir;
    },

    get_table: function(roomname, tilename, tablename) {
        console.log('NAV>   get_table('+roomname+', '+tilename+', '+tablename+')');
        if (!Memory.rooms[roomname]) { return new Routingtable();  }
        if (!Memory.rooms[roomname].r) { return new Routingtable(); }
        if (!Memory.rooms[roomname].r[tilename]) { return new Routingtable(); }
        if (!Memory.rooms[roomname].r[tilename][tablename]) { return new Routingtable(); }
        Memory.rooms[roomname].r[tilename].mru = Game.time;
        return new Routingtable(Memory.rooms[roomname].r[tilename][tablename]);
    },

    set_table: function(roomname, tilename, tablename, table) {
        console.log('NAV>   set_table('+roomname+', '+tilename+', '+tablename+', '+table+')');
        if (!Memory.rooms[roomname]) { Memory.rooms[roomname] = {}; }
        if (!Memory.rooms[roomname].r) { Memory.rooms[roomname].r = {}; }
        if (!Memory.rooms[roomname].r[tilename]) { Memory.rooms[roomname].r[tilename] = {}; }
        Memory.rooms[roomname].r[tilename].mru = Game.time;
        Memory.rooms[roomname].r[tilename][tablename] = table.asBinaryString();
    },

    direction_of_vector: function(vec) {
        if (vec.x == 0 && vec.y <  0) { return 1; }
        if (vec.x >  0 && vec.y <  0) { return 2; }
        if (vec.x >  0 && vec.y == 0) { return 3; }
        if (vec.x >  0 && vec.y >  0) { return 4; }
        if (vec.x == 0 && vec.y >  0) { return 5; }
        if (vec.x <  0 && vec.y >  0) { return 6; }
        if (vec.x <  0 && vec.y == 0) { return 7; }
        if (vec.x <  0 && vec.y <  0) { return 8; }
        console.log('NAV> Internal error direction_of_vector('+vec+')');
        return 0; // Something is wrong with vec
    },

};
