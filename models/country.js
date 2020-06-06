module.exports = (sequelize, type) => {
  return sequelize.define('country', {
    country_code: type.STRING,
    country_name: type.STRING,
    ems_small_sample: type.BOOLEAN,
    ems_available: type.INTEGER,
    ems_averagetime: type.FLOAT,
    ems_totalaveragetime: type.FLOAT,
    ems_lastsucessfullyshipped: type.BIGINT,
    airsp_small_sample: type.BOOLEAN,
    airsp_available: type.INTEGER,
    airsp_averagetime: type.FLOAT,
    airsp_totalaveragetime: type.FLOAT,
    airsp_lastsucessfullyshipped: type.BIGINT,
    salspr_small_sample: type.BOOLEAN,
    salspr_available: type.INTEGER,
    salspr_averagetime: type.FLOAT,
    salspr_totalaveragetime: type.FLOAT,
    salspr_lastsucessfullyshipped: type.BIGINT,
    salspu_small_sample: type.BOOLEAN,
    salspu_available: type.INTEGER,
    salspu_averagetime: type.FLOAT,
    salspu_totalaveragetime: type.FLOAT,
    salspu_lastsucessfullyshipped: type.BIGINT,
    salp_small_sample: type.BOOLEAN,
    salp_available: type.INTEGER,
    salp_averagetime: type.FLOAT,
    salp_totalaveragetime: type.FLOAT,
    salp_lastsucessfullyshipped: type.BIGINT,
    dhl_small_sample: type.BOOLEAN,
    dhl_available: type.INTEGER,
    dhl_averagetime: type.FLOAT,
    dhl_totalaveragetime: type.FLOAT,
    dhl_lastsucessfullyshipped: type.BIGINT,
    airp_small_sample: type.BOOLEAN,
    airp_available: type.INTEGER,
    airp_averagetime: type.FLOAT,
    airp_totalaveragetime: type.FLOAT,
    airp_lastsucessfullyshipped: type.BIGINT,
  });
};

/*

code: country code
ems_...
    available
            0: Unavailable
            1: Available
            2: Suspended
            3: Blocked
            4~: Not used...
    averagetime
            Average shipping time in days
    totalaveragetime
            Avegage shipping time in days
    lastsucessfullyshipped
            Date-time stamp of last shipped
              order that has been delivered
airsp...
salspr...
salspu...
salp...
dhl...
airp...

*/
