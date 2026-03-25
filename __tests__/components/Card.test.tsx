/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Card } from '../../src/components/Card';

describe('Card', () => {
  it('renders children', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Card>
          <Card>Inner</Card>
        </Card>
      );
    });
    expect(tree!).toMatchSnapshot();
    expect(tree!.root.findByType(Card).props.children).toBeDefined();
  });

  it('applies optional style', () => {
    const customStyle = { flex: 1 };
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Card style={customStyle}>
          <></>
        </Card>
      );
    });
    const view = tree!.root.findByType(require('react-native').View);
    expect(view.props.style).toEqual(
      expect.arrayContaining([expect.any(Object), customStyle])
    );
  });
});
