import { BridgeLink, createBridgeLink } from './';
import { GraphQLError, parse } from 'graphql';

import { ApolloClient } from '@apollo/client/core';
import { ApolloLink } from '@apollo/client/link/core';
import { InMemoryCache } from '@apollo/client/cache';
import { POSTS } from '../testUtils/queries.example';
import { makeExecutableSchema } from '@graphql-tools/schema';
import schemaExample from '../testUtils/schema.example';
import { setContext } from "@apollo/client/link/context";
import sinon from 'sinon';
import test from 'ava';

const assoc = (name, value) => obj => ({ ...obj, [name]: value });

test('BridgeLink calls resolver', async t => {
  const posts = [
    {
      id: '123',
      title: 'someTitle',
      body: 'post body',
      author: null,
    },
  ];
  const postsReturned = posts.map(assoc('__typename', 'Post'));
  const opts = {
    schema: schemaExample,
    resolvers: {
      Query: {
        posts: sinon.stub().returns(Promise.resolve(posts)),
      },
    },
  };
  const link = new BridgeLink(opts);
  const cache = new InMemoryCache();
  const client = new ApolloClient({ link, cache });
  const res = await client.query({ query: POSTS });
  t.true(opts.resolvers.Query.posts.calledOnce);
  t.deepEqual(res.data.posts, postsReturned);
});

test('BridgeLink calls deep resolver', async t => {
  const author = {
    id: '987',
    username: 'hulu',
    email: 'hulu@email.com',
  };
  const posts = [
    {
      id: '123',
      title: 'someTitle',
      body: 'post body',
      authorId: '987',
    },
  ];
  const authorReturned = { ...author, __typename: 'User' };
  const context = {
    GraphQl: 'isCool',
    headers: {
      'X-hulu': 'sun',
    },
  };
  const opts = {
    schema: schemaExample,
    resolvers: {
      Query: {
        posts: () => Promise.resolve(posts),
      },
      Post: {
        author: sinon.stub().returns(Promise.resolve(author)),
      },
    },
  };
  const contextLink = setContext(() => context);
  const bridgeLink = new BridgeLink(opts);
  const cache = new InMemoryCache();
  const client = new ApolloClient({
    link: contextLink.concat(bridgeLink),
    cache,
  });
  const res = await client.query({ query: POSTS });
  t.true(opts.resolvers.Post.author.calledOnce);
  t.deepEqual(res.data.posts[0].author, authorReturned);

  // keeps context as is
  const calledWithContext = opts.resolvers.Post.author.args[0][2];
  t.is(calledWithContext.GraphQl, context.GraphQl);
  t.is(calledWithContext.headers['X-hulu'], context.headers['X-hulu']);
});

test.skip('BridgeLink mocks data', async t => {
  const opts = {
    schema: schemaExample,
    mock: true,
  };
  const link = new BridgeLink(opts);
  const cache = new InMemoryCache();
  const client = new ApolloClient({ link, cache });
  const res = await client.query({ query: POSTS });
  t.true(res.data.posts.length > 0, 'should get some mocked data');
  t.truthy(res.data.posts[0].author.id, 'should have mocked author');
});

test('BridgeLink should accept executable schema', async t => {
  const posts = [
    {
      id: '123',
      title: 'someTitle',
      body: 'post body',
      author: null,
    },
  ];
  const resolvers = {
    Query: {
      posts: sinon.stub().returns(Promise.resolve(posts)),
    },
  };
  const postsReturned = posts.map(assoc('__typename', 'Post'));
  const schema = makeExecutableSchema({ typeDefs: schemaExample, resolvers });
  const opts = { schema };
  const link = new BridgeLink(opts);
  const cache = new InMemoryCache();
  const client = new ApolloClient({ link, cache });
  const res = await client.query({ query: POSTS });
  t.true(resolvers.Query.posts.calledOnce);
  t.deepEqual(res.data.posts, postsReturned);
});

test('BridgeLink should accept parsed schema', async t => {
  const posts = [
    {
      id: '123',
      title: 'someTitle',
      body: 'post body',
      author: null,
    },
  ];
  const resolvers = {
    Query: {
      posts: sinon.stub().returns(Promise.resolve(posts)),
    },
  };
  const postsReturned = posts.map(assoc('__typename', 'Post'));
  const schema = parse(schemaExample);
  const opts = { schema, resolvers };
  const link = new BridgeLink(opts);
  const cache = new InMemoryCache();
  const client = new ApolloClient({ link, cache });
  const res = await client.query({ query: POSTS });
  t.true(resolvers.Query.posts.calledOnce);
  t.deepEqual(res.data.posts, postsReturned);
});

test('BridgeLink should throw on non accepted schema', t => {
  const resolvers = {
    Query: {
      posts: () => ({}),
    },
  };
  const schema = { nonValid: 'schema' };
  const opts = { schema, resolvers };
  t.throws(() => new BridgeLink(opts));
});

test('BridgeLink should return error', async t => {
  const errorMessage = 'bad request';
  const resolvers = {
    Query: {
      posts: sinon.stub().returns(new Error(errorMessage)),
    },
  };
  const schema = parse(schemaExample);
  const opts = { schema, resolvers };
  const link = new BridgeLink(opts);
  const cache = new InMemoryCache();
  const client = new ApolloClient({ link, cache });
  const res = await t.throws(client.query({ query: POSTS }));
  t.true(res instanceof Error);
  t.true(Array.isArray(res.graphQLErrors));
  t.true(res.graphQLErrors[0] instanceof GraphQLError);
  t.is(res.graphQLErrors[0].message, errorMessage);
});

test('createBridgeLink - creates link', t => {
  const schema = schemaExample;
  const resolvers = {};
  const mock = false;
  const context = { gq: 'is cool' };
  const link = createBridgeLink({ schema, resolvers, mock, context });
  t.true(link instanceof ApolloLink);
});

test('createBridgeLink - throws on no schema', t => {
  const schema = '';
  const resolvers = {};
  const mock = false;
  const context = {};
  t.throws(() => createBridgeLink({ schema, resolvers, mock, context }));
});
