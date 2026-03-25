/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';

describe('ScreenWrapper', () => {
  it('renders title and children', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ScreenWrapper title="Home">
          <ScreenWrapper title="Inner">Content</ScreenWrapper>
        </ScreenWrapper>
      );
    });
    const texts = tree!.root.findAllByType(require('react-native').Text);
    const titles = texts.filter((t) => t.props.children === 'Home');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('shows status row with app name', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ScreenWrapper title="Chat">Body</ScreenWrapper>
      );
    });
    const texts = tree!.root.findAllByType(require('react-native').Text);
    const hasAiDiet = texts.some(
      (t) =>
        t.props.children === 'AI Diet' ||
        (Array.isArray(t.props.children) && t.props.children.includes('AI Diet'))
    );
    expect(hasAiDiet).toBe(true);
  });

  it('accepts accent prop', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <ScreenWrapper title="Profilo" accent="violet">
          <></>
        </ScreenWrapper>
      );
    });
    expect(tree!).toMatchSnapshot();
  });
});
