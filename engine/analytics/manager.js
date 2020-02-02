const models = require('../../../models');
const _ = require('lodash');
const log = require('../../../utils/logger');
const importDomain = require('./utils').importDomain;
const importCommunity = require('./utils').importCommunity;
const importGroup = require('./utils').importGroup;
const importPost = require('./utils').importPost;
const importPoint = require('./utils').importPoint;

const updateDomain = (domainId, done) => {
  log.info('updateDomain');

  models.Domain.unscoped().findOne({
    where: {
      id: domainId
    },
    attributes: ['id','name','default_locale'],
    order: [
      ['id', 'asc' ]
    ]
  }).then((domain) => {
    if (domain) {
      importDomain(domain, done);
    } else {
      done("Can't find domain for similarities import");
    }
  }).catch((error) => {
    done(error);
  });
};

const updateCommunity = (communityId, done) => {
  log.info('updateCommunity');

  models.Community.unscoped().findOne({
    where: {
      id: communityId
    },
    include: [
      {
        model: models.Domain,
        attributes: ['id','default_locale'],
        required: true
      }
    ],
    attributes: ['id','name','default_locale'],
    order: [
      ['id', 'asc' ]
    ]
  }).then((community) => {
    if (community) {
      importCommunity(community, done);
    } else {
      done("Can't find community for similarities import");
    }
  }).catch(function (error) {
    done(error);
  });
};

const updateGroup = (groupId, done) => {
  log.info('updateGroup');

  models.Group.unscoped().findOne({
    where: {
      id: groupId
    },
    include: [
      {
        model: models.Community,
        attributes: ['id','access','status','default_locale'],
        required: true,
        include: [
          {
            model: models.Domain,
            attributes: ['id','default_locale'],
            required: true
          }
        ]
      }
    ],
    attributes: ['id','name'],
    order: [
      ['id', 'asc' ]
    ]
  }).then((group) => {
    if (group) {
      importGroup(group, done);
    } else {
      done("Can't find group for similarities import");
    }
  }).catch(function (error) {
    done(error);
  });
};

const updatePost = (postId, done) => {
  log.info('updatePost');

  models.Post.unscoped().findOne(
    {
      where: {
        id: postId
      },
      include: [
        {
          model: models.Point,
          required: false,
          attributes: ['id','content'],
        },
        {
          model: models.Group,
          required: true,
          attributes: ['id','access','status','configuration'],
          include: [
            {
              attributes: ['id','formats'],
              model: models.Image, as: 'GroupLogoImages',
              required: false
            },
            {
              model: models.Community,
              attributes: ['id','access','status','default_locale'],
              required: true,
              include: [
                {
                  attributes: ['id','formats'],
                  model: models.Image, as: 'CommunityLogoImages',
                  required: false
                },
                {
                  model: models.Domain,
                  attributes: ['id','default_locale'],
                  required: true
                }
              ]
            }
          ]
        },
        {
          model: models.Image,
          required: false,
          as: 'PostHeaderImages',
          attributes: ['id','formats']
        },
        {
          model: models.Video,
          required: false,
          attributes: ['id','formats','updated_at','viewable','public_meta'],
          as: 'PostVideos',
          include: [
            {
              model: models.Image,
              as: 'VideoImages',
              attributes:["formats",'updated_at'],
              required: false
            },
          ]
        },
        {
          model: models.Audio,
          required: false,
          attributes: ['id','formats','updated_at','listenable'],
          as: 'PostAudios',
        }
      ],
      order: [
        ['id', 'desc' ],
        [ { model: models.Image, as: 'PostHeaderImages' } ,'updated_at', 'asc' ],
        [ { model: models.Group }, { model: models.Image, as: 'GroupLogoImages' } , 'created_at', 'desc' ],
        [ { model: models.Group }, { model: models.Community }, { model: models.Image, as: 'CommunityLogoImages' } , 'created_at', 'desc' ]
      ],
      attributes: ['id','name','description','group_id','category_id','status','deleted','language','created_at',
        'user_id','official_status','public_data','cover_media_type',
        'counter_endorsements_up','counter_endorsements_down','counter_points','counter_flags']
    }).then((post) => {
      if (post) {
        importPost(post, done);
      } else {
        done("Can't find post for similarities import");
      }
  }).catch(function (error) {
    done(error);
  });
};

const updatePoint = (pointId, done) => {
  log.info('updatePoint');

  models.Point.unscoped().findOne({
    where: {
      id: pointId
    },
    attributes: ['id', 'name', 'content', 'user_id', 'post_id', 'value', 'status', 'counter_quality_up', 'counter_quality_down', 'language', 'created_at'],
    order: [
      [models.PointRevision, 'created_at', 'asc'],
      [{model: models.Video, as: "PointVideos"}, 'updated_at', 'desc'],
      [{model: models.Audio, as: "PointAudios"}, 'updated_at', 'desc'],
    ],
    include: [
      {
        model: models.PointRevision,
        attributes: ['content', 'value', 'created_at'],
        required: false
      },
      {
        model: models.Video,
        required: false,
        attributes: ['id', 'formats'],
        as: 'PointVideos'
      },
      {
        model: models.Audio,
        required: false,
        attributes: ['id', 'formats'],
        as: 'PointAudios'
      },
      {
        model: models.Post,
        attributes: ['id', 'group_id','created_at','category_id','official_status','status'],
        required: true,
        include: [
          {
            model: models.Group,
            attributes: ['id','access','status','configuration'],
            required: true,
            include: [
              {
                model: models.Community,
                attributes: ['id','access','status','default_locale'],
                required: true,
                include: [
                  {
                    model: models.Domain,
                    attributes: ['id','default_locale'],
                    required: true
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }).then(function (point) {
    if (point) {
      importPoint(point, done);
    } else {
      done("Can't find point for similarities import");
    }
  }).catch(function (error) {
    done(error);
  });
};

const updateCollection = (workPackage, done) => {
  if (process.env.AC_ANALYTICS_KEY &&
      process.env.AC_ANALYTICS_CLUSTER_ID &&
      process.env.AC_ANALYTICS_BASE_URL) {
    if (workPackage.domainId) {
      updateDomain(workPackage.domainId, done)
    } else if (workPackage.communityId) {
      updateCommunity(workPackage.communityId, done)
    } else if (workPackage.groupId) {
      updateGroup(workPackage.groupId, done)
    } else if (workPackage.postId) {
      updatePost(workPackage.postId, done)
    } else if (workPackage.pointId) {
      updatePoint(workPackage.pointId, done)
    } else {
      done("Couldn't find any collection to update similarities", { workPackage });
    }
  } else {
    log.warn("Can't find AC_ANALYTICS_KEY, AC_ANALYTICS_CLUSTER_ID & AC_ANALYTICS_BASE_URL for the similarities engine");
    done();
  }
};

module.exports = {
  updateCollection
};