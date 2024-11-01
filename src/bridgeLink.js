import { GraphQLSchema, graphql, print } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { ApolloLink } from '@apollo/client/link/core';
import Observable from 'zen-observable';

export const createBridgeLink = ({ schema, resolvers, mock }) => {
  let executableSchema;
  if (typeof schema === 'string') {
    executableSchema = makeExecutableSchema({ typeDefs: schema, resolvers });
  } else if (schema.kind === 'Document') {
    executableSchema = makeExecutableSchema({
      typeDefs: print(schema),
      resolvers,
    });
  } else if (schema instanceof GraphQLSchema) {
    executableSchema = schema;
  } else {
    throw new Error(
      'schema should be plain text, parsed schema or executable schema'
    );
  }

  if (mock)
    addMocksToSchema({
      schema: executableSchema,
      preserveResolvers: true,
    });

  return new ApolloLink(
    operation =>
      new Observable(observer => {
        graphql({
          schema: executableSchema,
          source: print(operation.query),
          contextValue: operation.getContext(),
          variableValues: operation.variables,
          operationName: operation.operationName,
        })
          .then(data => {
            observer.next(data);
            observer.complete();
          })
          .catch(err => {
            /* istanbul ignore next */
            observer.error(err);
          });
      })
  );
};

export class BridgeLink extends ApolloLink {
  requester;

  constructor(opts) {
    super();
    this.requester = createBridgeLink(opts).request;
  }

  request(op) {
    return this.requester(op);
  }
}
