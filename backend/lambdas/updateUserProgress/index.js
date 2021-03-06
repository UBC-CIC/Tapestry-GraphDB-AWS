/**
 * The following is the Lambda function set-up for the Gremlin-Lambda combination,
 * as recommended by AWS Documentation: https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html
 * All changes involving interaction with gremlin should be done in the query async method.
 */

/**
 * POST Request
 * Required in request body:
 * - userId: Id of the user to update the progress for
 * - nodeId: Id of the node to update the progress for, formatted as "node-x" where x is node->id
 * - progressValue: float between 0 and 1 representing the progress of the user for the node
 * - tapestryId: Id of the tapestry 
 */

const gremlin = require('gremlin');
const async = require('async');
const {initDB,errorHandler} = require('/opt/databaseInit');
const t = gremlin.process.t;
const __ = gremlin.process.statics;
const p = gremlin.process.P;


let {g,conn} = initDB(process.env);

async function query(request) {
  // Check if user progress exists
  return g.V(request.nodeId).choose(__.inE('user_data').where(__.outV().has('userId',request.userId)).count().is(0),
  // No user progress exists so add an edge
  __.addE('user_data').from_(__.V().hasLabel('user').has('userId',request.userId)).to(__.V(request.nodeId)),
  // User progress exists
  __.V(request.nodeId).inE('user_data').where(__.outV().has('userId',request.userId))
  ).property('percent_completed',request.progressValue).property('tapestryId',request.tapestryId).next()
}

async function doQuery(request) {
  if(request){
    var result = query(request);
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
      var result = await doQuery(request);
      if(result.value){
        return {
          statusCode: 200,
          body: JSON.stringify({
          task: `Updated user-${request.userId} progress for ${request.nodeId} to ${request.progressValue}`
        })
      }
      }
      return {
        statusCode: 404,
        body: JSON.stringify("Error updating progress")
      }
    })
};