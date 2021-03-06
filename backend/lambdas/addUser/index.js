/**
 * The following is the Lambda function set-up for the Gremlin-Lambda combination,
 * as recommended by AWS Documentation: https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html
 * All changes involving interaction with gremlin should be done in the query async method.
 */

/**
 * POST Request
 * Required in request body:
 * - id: user id
 * - roles: user's roles as a JSON string
 */

const gremlin = require('gremlin');
const async = require('async');
const {initDB,errorHandler} = require('/opt/databaseInit');
const t = gremlin.process.t;
const __ = gremlin.process.statics;

let {g,conn} = initDB(process.env);

async function query(id,roles) {
  // Create user if not created
  var result = g.V().hasLabel('user').has('userId',id).count().choose(__.is(0),__.addV('user').property('userId',id),__.V().hasLabel('user').has('userId',id)).next()
  // Handle roles
  if(roles && roles.length != 0){
    await result;
    var promises = [];
    for(var i in  roles){
      var role = roles[i];
      promises.push(
        // Create role node if it does not exist and then create a has_role edge to it if it does not exist.  
        g.V().hasLabel('user').has('userId',id).outE('has_role').where(__.inV().has('name',role)).count()
        .choose(__.is(0),__.addE('has_role').from_(__.V().hasLabel('user').has('userId',id)).to(__.V().hasLabel('role').has('name',role).count()
        .choose(__.is(0),__.addV('role').property('name',role),__.V().hasLabel('role').has('name',role))),
        __.V().hasLabel('user').has('userId',id).outE('has_role').where(__.inV().has('name',role)))
        .next()
      );
    }
    return Promise.all(promises);
  }
  return result;
}

async function doQuery(id,roles) {
  if(id){
    let result = await query(id,roles);
    return result;
  }
  return;
}


exports.handler = async (event, context) => {

  return async.retry(
    { 
      times: 5,
      interval: 1000,
      errorFilter: function (err) { 
        errorHandler(err,process.env);
      }

    }, 
    async ()=>{
      var request = JSON.parse(event.body);
      var result = await doQuery(request.id, request.roles);
      if(result){
          return {
            statusCode: 200,
            body: JSON.stringify(result)
          };
      }
      return {
        statusCode: 400,
        body: JSON.stringify("Bad request")
      }
    })
};