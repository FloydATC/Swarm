

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
            //console.log(this+' flag '+flag+' at '+flag.pos);

            // Remote mine sources tagged with a "harvest" flag
            if (flag.name.startsWith('harvest')) {
                // TODO ...
            }

            // Colonize rooms with "spawn" flag
            if (flag.name == 'spawn') {
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
            if (flag.name == 'tower') {
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

};
