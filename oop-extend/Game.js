

module.exports = {

    initialize: function() {
        //console.log(this+' initializing');
        for (var name in this.rooms) {
            var room = this.rooms[name];
            room.initialize();
        }

        // Act on flags
        for (var name in this.flags) {
            var flag = this.flags[name];
            console.log(this+' flag '+flag+' type '+flag.type()+' at '+flag.pos);

            // Remote mine sources tagged with a "harvest" flag
            if (flag.type() == 'harvest') {
                // Find nearest room with an owned controller
                console.log('Assigning owner room to flag '+flag);
                var lo_range = null;
                var lo_room = null;
                for (var name in this.rooms) {
                    var room = this.rooms[name];
                    if (room.controller && room.controller.my == true) {
                        var range = this.manhattanDistance(flag.pos.roomName, room.name);
                        console.log('  candidate room '+room+' range is '+range);
                        if (lo_range == null || range < lo_range) {
                            lo_range = range;
                            lo_room = room;
                        }
                    }
                }
                console.log('  assigned to room '+room);
                flag.memory = { owner: lo_room.name };
                // Add this flag to that room
                if (!lo_room.harvest_flags) { lo_room.harvest_flags = []; }
                lo_room.harvest_flags.push(flag);
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

    manhattanDistance: function() {
        return 1;
    },
};
