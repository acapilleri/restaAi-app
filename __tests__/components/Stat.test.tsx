/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Stat } from '../../src/components/Stat';

describe('Stat', () => {
  it('renders label, value and sub', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Stat label="peso oggi" value="72" sub="registrato oggi" />
      );
    });
    const texts = tree!.root.findAllByType(require('react-native').Text);
    const content = texts.map((t) => t.props.children?.toString?.() ?? t.props.children);
    expect(content.join(' ')).toContain('peso oggi');
    expect(content.join(' ')).toContain('72');
    expect(content.join(' ')).toContain('registrato oggi');
  });

  it('matches snapshot', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <Stat label="obiettivo" value="→ 70" sub="−2 finora" />
      );
    });
    expect(tree!).toMatchSnapshot();
  });
});
