const async = require("async");
const models = require("../../models");
const log = require('../utils/logger');
const queue = require('./queue');
const i18n = require('../utils/i18n');
const toJson = require('../utils/to_json');
const _ = require('lodash');

let airbrake = null;
if(process.env.AIRBRAKE_PROJECT_ID) {
  airbrake = require('../utils/airbrake');
}

let DelayedJobWorker = function () {};

const delayedCreatePriorityActivity = (workPackage, callback) => {
  const options = workPackage.workData;

  var context, actor, object;

  if (options.object)
    object = options.object;
  else
    object = {};

  if (options.context)
    context = options.context;
  else
    context = {};

  if (options.actor)
    actor = options.actor;
  else
    actor = {};

  if (options.userId)
    actor['userId'] = options.userId;

  if (options.domainId)
    object['domainId'] = options.domainId;

  if (options.communityId)
    object['communityId'] = options.communityId;

  if (options.groupId)
    object['groupId'] = options.groupId;

  if (options.postId)
    object['postId'] = options.postId;

  if (options.pointId)
    object['pointId'] = options.pointId;

  if (options.endorsementId)
    object['endorsementId'] = options.endorsementId;

  if (options.pointQualityId)
    object['pointQualityId'] = options.pointQualityId;

  if (options.ratingId)
    object['ratingId'] = options.ratingId;

  async.series([
    // Checking for missing values for community or group if its a post related event
    function (seriesCallback) {
      if (options.postId==null || (options.groupId && options.communityId)) {
        seriesCallback();
      } else if (options.groupId) {
        models.Group.findOne({where: { id: options.groupId },
          attributes: ['id','community_id']
        }).then(function(group) {
          if (group) {
            log.info("Found group info for post acitivity from app");
            options.communityId = group.community_id;
            seriesCallback();
          } else {
            seriesCallback("Can't find group");
          }
        }).catch(function(error) {
          seriesCallback(error);
        });
      } else if (options.postId) {
        log.info("Looking for post, group and community START");
        models.Post.findOne({
          where: { id: options.postId },
          attributes: ['id','group_id'],
          include: [
            {
              model: models.Group,
              attributes: ['id','community_id']
            }
          ]}).then(function(post) {
            log.info("Looking for post, group and community END");
            if (post) {
              log.info("Found post info for post acitivity from app");
              options.groupId = post.Group.id;
              options.communityId = post.Group.community_id;
              seriesCallback();
            } else {
              seriesCallback("Can't find post");
            }
        }).catch(function(error) {
          seriesCallback(error);
        });
      } else {
        seriesCallback("Strange state of create ac activity looking up community id");
      }
    }
  ], function (error) {
    if (error) {
      callback(error);
    } else {
      models.AcActivity.build({
        type: options.type,
        status: 'active',
        sub_type: options.subType,
        actor: actor,
        object: object,
        context: context,
        user_id: options.userId,
        domain_id: options.domainId,
        community_id: options.communityId,
        group_id: options.groupId,
        post_id: options.postId,
        point_id: options.pointId,
        post_status_change_id: options.postStatusChangeId,
        access: !isNaN(options.access) ? options.access : models.AcActivity.ACCESS_PRIVATE
      }).save().then(function(activity) {
        if (activity) {
          if (activity.type!='activity.fromApp') {
            queue.create('process-activity', activity).priority('critical').removeOnComplete(true).save();
          }
          log.info('Activity Created', { activityId: activity.id, userId: options.userId});
          callback();
        } else {
          callback('Activity Not Found');
        }
      }).catch(function(error) {
        log.error('Activity Created Error', { err: error });
        callback(error);
      });
    }
  });
};

const delayedCreateActivityFromApp = (workPackage, callback) => {
  const workData = workPackage.workData;

  models.AcClientActivity.build({
    type: 'activity.fromApp',
    sub_type: workData.body.type,
    actor: { appActor: workData.body.actor },
    object: { name: workData.body.object, target: workData.body.target ? JSON.parse(workData.body.target) : null },
    context: { pathName: workData.body.path_name, name: workData.body.context, eventTime: workData.body.event_time,
      sessionId: workData.body.sessionId, userAgent: workData.body.user_agent, server_timestamp: workData.body.server_timestamp },
    user_id: workData.userId,
    domain_id: workData.domainId,
    group_id: workData.groupId,
    community_id: workData.communityId,
    post_id: workData.postId
  }).save().then(function(clientActivity) {
    if (!clientActivity) {
      log.error('Client Activity not created', { context: 'createClientActivity', errorStatus: 500 });
    }
    callback();
  }).catch(function(error) {
    log.error('Client Activity Created Error', { context: 'createClientActivity', err: error });
    callback(error);
  });
};

DelayedJobWorker.prototype.process = (workPackage, callback) => {
  switch (workPackage.type) {
    case 'create-activity-from-app':
      delayedCreateActivityFromApp(workPackage, callback);
      break;
    case 'create-priority-activity':
      delayedCreatePriorityActivity(workPackage, callback);
      break;
    default:
      callback("Unknown type for workPackage: " + workPackage.type);
  }
};

module.exports = new DelayedJobWorker();
