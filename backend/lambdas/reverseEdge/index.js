/**
 * The following is the Lambda function set-up for the Gremlin-Lambda combination,
 * as recommended by AWS Documentation: https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions-examples.html
 * All changes involving interaction with gremlin should be done in the query async method.
 */

/**
 * POST Request
 * Required in request body:
 * - from: id of the source node of the edge to reverse, formatted as "node-x" where x is node->id
 * - to: id of the target node of the edge to reverse, formatted as "node-x" where x is node->id 
 */

const gremlin = require('gremlin');
const async = require('async');
const {initDB,errorHandler} = require('/opt/databaseInit');
const t = gremlin.process.t;
const __ = gremlin.process.statics;

let {g,conn} = initDB(process.env);

async function query(from,to) {
  if(from != undefined && to != undefined){
      return Promise.all(
        [
        // Delete the existing edge  
        g.V(from).outE('connected_to').where(__.inV().has(t.id,to)).drop().next(),
        // Add a new, reversed edge
        g.addE('connected_to').from_(__.V(to)).to(__.V(from)).next()
        ]
        );
  }
}

async function doQuery(from,to) {
  let result = await query(from,to);
  return result;
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
      var result = await doQuery(request.from, request.to);
      if(result){
          return {
              statusCode: 200,
              body: "Reverse Successful"
          }
      }
      else{
          return {
              statusCode: 400,
              body: "Bad Request :("
          }
      }
    })
};