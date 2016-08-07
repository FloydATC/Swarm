
module.exports = {

    getRoomManhattanDistance: function(r1, r2) {
        var re = /([A-Z])(\d+)([A-Z])(\d+)/;
        var r1_parts = re.exec(r1);
        var r2_parts = re.exec(r2);
        console.log(JSON.stringify(r1_parts));
        console.log(JSON.stringify(r2_parts));
        return 1;
    },

}
