

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        for (var name in this.rooms) {
            var room = this.rooms[name];
            room.initialize();
        }

        // Act on flags
        console.log('flags: '+flags);
        for (var name in this.flags) {
            var flag = this.flags[name];
            //console.log(this+' flag '+flag+' type '+flag.type()+' at '+flag.pos);

            // Remote mine sources tagged with a "harvest" flag
            if (flag.type() == 'harvest') {
                // Find nearest room with an owned controller
                //console.log('Assigning owner room to flag '+flag);
                var lo_range = null;
                var lo_room = null;
                for (var name in this.rooms) {
                    var room = this.rooms[name];
                    if (room.controller && room.controller.my == true) {
                        var range = this.manhattanDistance(flag.pos.roomName, room.name);
                        //console.log('  candidate room '+room+' range is '+range);
                        if (lo_range == null || range < lo_range) {
                            lo_range = range;
                            lo_room = room;
                        }
                    }
                }
                //console.log('  assigned to room '+room);
                if (typeof flag.memory == 'undefined') { flag.memory = {}; }
                flag.memory.owner = lo_room.name;
                // Add this flag to that room
                if (!lo_room.harvest_flags) { lo_room.harvest_flags = []; }
                lo_room.harvest_flags.push(flag);

                // Calculate and set spawn parameters
                flags.memory.lead_time = 200; // How many ticks from spawn to arrival? FIXME!!!
                flags.memory.workforce = { 'Miner': 1, 'Fetcher': 2 };

                //flag.memory.frequency = 250; // TTL / 6
                //flag.memory.ticks = (flag.memory.ticks + 1) || 0;
            }

            // Colonize rooms with "spawn" flag
            if (flag.type() == 'spawn') {
                var room_name = flag.pos.roomName;
                if (Game.rooms[room_name] && Game.rooms[room_name].controller && Game.rooms[room_name].controller.my) {
                    var result = Game.rooms[room_name].createConstructionSite(flag.pos, STRUCTURE_SPAWN);
                    if (result == OK) {
                        flag.remove();
                    } else {
                        console.log(this+' createConstructionSite('+flag.pos+', STRUCTURE_SPAWN) result='+result);
                    }
                } else {
                    Game.colonize = flag.pos.roomName;
                }
            }

            // Place tower at "tower" when possible
            if (flag.type() == 'tower') {
                var room_name = flag.pos.roomName;
                if (Game.rooms[room_name] && Game.rooms[room_name].controller && Game.rooms[room_name].controller.my && Game.rooms[room_name].controller.level >= 3) {
                    var result = Game.rooms[room_name].createConstructionSite(flag.pos, STRUCTURE_TOWER);
                    if (result == OK) {
                        flag.remove();
                    } else {
                        console.log(this+' createConstructionSite('+flag.pos+', STRUCTURE_TOWER) result='+result);
                    }
                }
            }
        }


    },

    manhattanDistance: function(r1, r2) {
        // The Manhattan distance between two rooms, calculated from the names.
        // = same as linear distance except no diagonal moves allowed (as is the actual case)
        var regex = /([EW])(\d+)([NS])(\d+)/;
        var r1_parts = regex.exec(r1);
        var r2_parts = regex.exec(r2);
        //console.log(r1+' parts: '+JSON.stringify(r1_parts));
        //console.log(r2+' parts: '+JSON.stringify(r2_parts));
        if (r1_parts == null || r2_parts == null) { return 0; } // This happens in simulator
        if (r1_parts[1] != r2_parts[1]) { r1_parts[2] = r1_parts[2] * -1 } // East is opposite of west
        if (r1_parts[3] != r2_parts[3]) { r1_parts[4] = r1_parts[4] * -1 } // North is opposite of south
        return Math.abs(r1_parts[2] - r2_parts[2]) + Math.abs(r1_parts[4] - r2_parts[4]);
    },
};
