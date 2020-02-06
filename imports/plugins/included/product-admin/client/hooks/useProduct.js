import { useState, useCallback, useMemo } from "react";
import gql from "graphql-tag";
import _ from "lodash";
import { useHistory, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/react-hooks";
import { Media } from "/imports/plugins/core/files/client";
import { Meteor } from "meteor/meteor";
import { Reaction, formatPriceString, i18next } from "/client/api";
import { getPrimaryMediaForItem, ReactionProduct, Catalog } from "/lib/api";
import { Tags, Templates } from "/lib/collections";
import getOpaqueIds from "/imports/plugins/core/core/client/util/getOpaqueIds";
import useCurrentShopId from "/imports/client/ui/hooks/useCurrentShopId";
import encodeOpaqueId from "@reactioncommerce/api-utils/encodeOpaqueId.js";
import { useSnackbar } from "notistack";

import PRODUCT_QUERY from "./ProductQuery";
import UPDATE_PRODUCT from "./UpdateProductMutation";
import UpdateProductVariantMutation from "./UpdateProductVariantMutation";

const encodeProductOpaqueId = encodeOpaqueId("reaction/product");

const getVariantIds = (variants) => Array.isArray(variants) && variants.map((variant) => variant._id);

const ARCHIVE_PRODUCTS = gql`
  mutation archiveProducts($input: ArchiveProductsInput!) {
    archiveProducts(input: $input) {
      products {
        _id
      }
    }
  }
`;

const CLONE_PRODUCTS = gql`
  mutation cloneProducts($input: CloneProductsInput!) {
    cloneProducts(input: $input) {
      products {
        _id
      }
    }
  }
`;

const CREATE_VARIANT = gql`
mutation createProductVariant($input: CreateProductVariantInput!) {
  createProductVariant(input: $input) {
    variant {
      _id
    }
  }
}
`;

/**
 * Metafield to remove
 * @param {String} productId Product ID
 * @param {Object} metafield Metafield object
 * @param {String} metafield.key Key
 * @param {String} metafield.value Value
 * @returns {undefined} No return
 */
export function handleMetaRemove(productId, metafield) {
  Meteor.call("products/removeMetaFields", productId, metafield);
}

/**
 * Restore an archived product
 * @param {Object} product Product object
 * @returns {undefined} No return
 */
export function handleProductRestore(product) {
  Meteor.call("products/updateProductField", product._id, "isDeleted", false);
}

/**
 * Save a product field
 * @param {String} productId Product ID
 * @param {String} fieldName Field name to save
 * @param {Any} value Value for that field
 * @returns {undefined} No return
 */
export function handleProductFieldSave(productId, fieldName, value) {
  Meteor.call("products/updateProductField", productId, fieldName, value, (error) => {
    if (error) {
      Alerts.toast(error.message, "error");
      this.forceUpdate();
    }
  });
}

/**
 * Handle save of a product variant field
 * @param {String} variantId Variant id
 * @param {String} fieldName Field name
 * @param {Any} value Any value supported by the variant schema
 * @returns {undefined} No return
 */
export function handleProductVariantFieldSave(variantId, fieldName, value) {
  Meteor.call("products/updateProductField", variantId, fieldName, value, (error) => {
    if (error) {
      Alerts.toast(error.message, "error");
    }
  });
}


/**
 * Toggle product visibility
 * @param {String} product Product
 * @returns {undefined} No return
 */
function handleToggleProductVisibility(product) {
  Meteor.call("products/updateProductField", product._id, "isVisible", !product.isVisible);
}

/**
 * @method useProduct
 * @summary useProduct hook
 * @param {Object} args input arguments
 * @param {String} args.productId Product Id to load product data for
 * @param {String} args.variantId Variant Id to load product data for
 * @param {String} args.optionId Option Id to load product data for
 * @returns {Object} Result containing the product and other helpers for managing that product
 */
function useProduct(args = {}) {
  const { enqueueSnackbar } = useSnackbar();

  const {
    productId: productIdProp,
    variantId: variantIdProp,
    optionId: optionIdProp
  } = args;
  const [newMetaField, setNewMetaField] = useState({ key: "", value: "" });
  const history = useHistory();
  const routeParams = useParams();
  const [updateProduct] = useMutation(UPDATE_PRODUCT);
  const [archiveProducts] = useMutation(ARCHIVE_PRODUCTS);
  const [cloneProducts] = useMutation(CLONE_PRODUCTS);
  const [createProductVariant] = useMutation(CREATE_VARIANT);
  const [updateProductVariant] = useMutation(UpdateProductVariantMutation);

  const [currentShopId] = useCurrentShopId();

  const productId = routeParams.handle || productIdProp;
  const variantId = routeParams.variantId || variantIdProp;
  const optionId = routeParams.optionId || optionIdProp;
  const shopId = routeParams.shopId || currentShopId;

  const { data: productQueryResult, isLoading, refetch: refetchProduct } = useQuery(PRODUCT_QUERY, {
    variables: {
      productId,
      shopId
    }
  });

  const { product } = productQueryResult || {};

  let variant;
  let option;
  // let parentVariant;

  if (product && variantId) {
    variant = product.variants.find(({ _id }) => _id === variantId);
  }

  if (product && variantId && optionId) {
    option = variant.options.find(({ _id }) => _id === optionId);
  }

  const onArchiveProduct = useCallback(async (product, redirectUrl) => {
    const opaqueProductIds = await getOpaqueIds([{ namespace: "Product", id: product._id }]);

    try {
      await archiveProducts({ variables: { input: { shopId, productIds: opaqueProductIds } } });
      Alerts.toast(i18next.t("productDetailEdit.archiveProductsSuccess"), "success");
      history.push(redirectUrl);
    } catch (error) {
      Alerts.toast(i18next.t("productDetailEdit.archiveProductsFail", { err: error }), "error");
    }
  }, [
    history,
    archiveProducts,
    shopId
  ]);


  const onCloneProduct = useCallback(async (product) => {
    const opaqueProductIds = await getOpaqueIds([{ namespace: "Product", id: product }]);

    try {
      await cloneProducts({ variables: { input: { shopId, productIds: opaqueProductIds } } });
      Alerts.toast(i18next.t("productDetailEdit.cloneProductSuccess"), "success");
    } catch (error) {
      Alerts.toast(i18next.t("productDetailEdit.cloneProductFail", { err: error }), "error");
    }
  }, [
    cloneProducts,
    shopId
  ]);

  const onCreateVariant = useCallback(async ({
    parentId: parentIdLocal = product._id,
    shopId: shopIdLocal = shopId
  }) => {
    try {
      await createProductVariant({
        variables: {
          input: {
            productId: parentIdLocal,
            shopId: shopIdLocal
          }
        }
      });
      // Because of the way GraphQL and meteor interact when creating a new variant,
      // we can't immediately redirect a user to the new variant as GraphQL is too quick
      // and the meteor subscription isn't yet updated. Once this page has been updated
      // to use GraphQL for data fetching, add a redirect to the new variant when it's created
      Alerts.toast(i18next.t("productDetailEdit.addVariant"), "success");
    } catch (error) {
      Alerts.toast(i18next.t("productDetailEdit.addVariantFail", { err: error }), "error");
    }
  }, [
    createProductVariant,
    product,
    shopId
  ]);

  const onToggleProductVisibility = useCallback(async () => {
    try {
      await updateProduct({
        variables: {
          input: {
            productId: product._id,
            shopId,
            product: {
              isVisible: !product.isVisible
            }
          }
        }
      });

      Alerts.toast(i18next.t("productDetailEdit.updateProductFieldSuccess"), "success");
    } catch (error) {
      Alerts.toast(i18next.t("productDetailEdit.updateProductFieldFail", { err: error }), "error");
    }
  }, [
    product,
    shopId,
    updateProduct
  ]);

  /**
   * @method onUpdateProduct
   * @param {Object} args
   * @param {Object} args.product Product fields to update
   * @param {Object} [args.productId] Product ID to update. Leave blank for current product.
   * @param {Object} [args.shopId] Shop ID of the product to update. Leave blank for current shop.
   */
  const onUpdateProduct = useCallback(async ({
    product: productLocal,
    productId: productIdLocal = product._id,
    shopId: shopIdLocal = shopId
  }) => {
    try {
      await updateProduct({
        variables: {
          input: {
            productId: productIdLocal,
            shopId: shopIdLocal,
            product: productLocal
          }
        }
      });

      enqueueSnackbar(i18next.t("productDetailEdit.updateProductFieldSuccess"), { variant: "success" });
    } catch (error) {
      enqueueSnackbar(i18next.t("productDetailEdit.updateProductFieldFail"), { variant: "error" });
    }
  }, [
    enqueueSnackbar,
    product,
    shopId,
    updateProduct
  ]);

  const handleDeleteProductTag = useCallback(async ({
    tag: tagLocal,
    product: productLocal = product,
    productId: productIdLocal = product._id,
    shopId: shopIdLocal = shopId
  }) => {
    const filteredTagIds = productLocal.tags.nodes
      .filter(({ _id }) => _id !== tagLocal._id)
      .map(({ _id }) => _id);

    try {
      await updateProduct({
        variables: {
          input: {
            productId: productIdLocal,
            shopId: shopIdLocal,
            product: {
              tagIds: filteredTagIds
            }
          }
        }
      });

      enqueueSnackbar(i18next.t("productDetailEdit.removeProductTagSuccess"), { variant: "success" });
    } catch (error) {
      enqueueSnackbar(i18next.t("productDetailEdit.removeProductTagFail"), { variant: "error" });
    }
  }, [
    enqueueSnackbar,
    product,
    shopId,
    updateProduct
  ]);


  const onUpdateProductVariant = useCallback(async ({
    variant: variantLocal,
    variantId: variantIdLocal,
    shopId: shopIdLocal = shopId
  }) => {
    try {
      await updateProductVariant({
        variables: {
          input: {
            shopId: shopIdLocal,
            variant: variantLocal,
            variantId: variantIdLocal
          }
        }
      });

      Alerts.toast(i18next.t("productDetailEdit.updateProductFieldSuccess"), "success");
    } catch (error) {
      Alerts.toast(i18next.t("productDetailEdit.updateProductFieldFail", { err: error }), "error");
    }
  }, [
    product,
    shopId,
    updateProductVariant,
    variant
  ]);

  const onToggleVariantVisibility = useCallback(async ({
    variant: variantLocal,
    shopId: shopIdLocal = shopId._id
  }) => {
    try {
      await updateProductVariant({
        variables: {
          input: {
            variantId: variantLocal._id,
            shopId: shopIdLocal,
            variant: {
              isVisible: !variantLocal.isVisible
            }
          }
        }
      });

      Alerts.toast(i18next.t("productDetailEdit.updateProductFieldSuccess"), "success");
    } catch (error) {
      Alerts.toast(i18next.t("productDetailEdit.updateProductFieldFail", { err: error }), "error");
    }
  }, [
    shopId,
    updateProductVariant
  ]);

  // Convert the social metadata to a format better suited for forms
  if (product && Array.isArray(product.socialMetadata)) {
    product.socialMetadata.forEach(({ service, message }) => {
      product[`${service}Msg`] = message;
    });
  }

  return {
    newMetaField,
    isLoading,
    handleDeleteProductTag,
    onArchiveProduct,
    onCloneProduct,
    onCreateVariant,
    onUpdateProduct,
    onProductVariantFieldSave: handleProductVariantFieldSave,
    option,
    onRestoreProduct: handleProductRestore,
    onToggleProductVisibility,
    onToggleVariantVisibility,
    onUpdateProductVariant,
    product: productQueryResult && productQueryResult.product,
    refetchProduct,
    setNewMetaField,
    shopId,
    variant
  };
}

export default useProduct;