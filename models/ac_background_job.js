"use strict";

module.exports = (sequelize, DataTypes) => {
  const AcBackgroundJob = sequelize.define("AcBackgroundJob", {
    progress: { type: DataTypes.INTEGER, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    data: DataTypes.JSONB
  }, {

    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    underscored: true,

    tableName: 'ac_background_jobs',
  });

  AcBackgroundJob.createJob = (done) => {
    sequelize.models.AcBackgroundJob.create({
      progress: 0
    }).then(job => {
      done(job.id);
    }).catch(error => {
      done(null, error)
    })
  }

  AcBackgroundJob.updateProgress = (id, progress, error, done) => {
    sequelize.models.AcBackgroundJob.findOne(
      {
        where: {
          id: id
        }
      }
    ).then((job) => {
      job.progress = progress;
      job.error = error;
      job.save().then(()=>{
        done();
      }).catch(error=>{
        done(error);
      });
    }).catch(error=>{
      done(error);
    });
  };

  return AcBackgroundJob;
};